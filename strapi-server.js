"use strict";

const contentApiRoutes = [
  {
    method: "GET",
    path: "/pages/:pageId/sections",
    handler: "controller.getPageSections",
    config: {
      policies: [],
    },
  },
  {
    method: "POST",
    path: "/pages/:sourcePageId/copy-to/:targetPageId",
    handler: "controller.copySections",
    config: {
      policies: [],
    },
  },
];

const componentCopyService = require("./server/src/services/component-copy");

// Helper: Find display field from content type
const getDisplayField = (page) => {
  const possibleFields = ['title', 'name', 'heading', 'label', 'displayName', 'slug'];
  for (const field of possibleFields) {
    if (page && page[field]) return page[field];
  }
  return page ? `ID: ${page.id}` : 'Unknown';
};

const controller = ({ strapi }) => ({
  // 🔍 List all content types and dynamic zones
  async getContentTypes(ctx) {
    try {
      const contentTypes = [];
      
      // Strapi content type registry'sini tara
      for (const [uid, contentType] of Object.entries(strapi.contentTypes)) {
        // Only get content types starting with api:: (custom content types)
        if (!uid.startsWith('api::')) continue;
        
        const dynamicZones = [];
        const attributes = contentType.attributes || {};
        
        // Find dynamic zone attributes
        for (const [attrName, attrConfig] of Object.entries(attributes)) {
          if (attrConfig.type === 'dynamiczone') {
            dynamicZones.push({
              name: attrName,
              components: attrConfig.components || [],
            });
          }
        }
        
        // Only add content types that contain dynamic zones
        if (dynamicZones.length > 0) {
          contentTypes.push({
            uid,
            kind: contentType.kind, // 'collectionType' veya 'singleType'
            displayName: contentType.info?.displayName || uid,
            singularName: contentType.info?.singularName || uid,
            pluralName: contentType.info?.pluralName || uid,
            dynamicZones,
          });
        }
      }
      
      // First, read saved settings from Strapi Store
      const pluginStore = strapi.store({
        environment: '',
        type: 'plugin',
        name: 'copy-any-component',
      });
      
      const savedSettings = await pluginStore.get({ key: 'settings' });
      
      // Get defaults from config file
      const pluginConfig = strapi.config.get('plugin::copy-any-component') || {};
      
      // Priority: 1. Saved from Store, 2. From config file, 3. Default
      const currentConfig = {
        contentType: savedSettings?.contentType || pluginConfig.contentType || 'api::page.page',
        dynamicZoneField: savedSettings?.dynamicZoneField || pluginConfig.dynamicZoneField || 'sections',
        savedInStore: !!savedSettings, // To inform the user
      };
      
      ctx.body = {
        data: {
          contentTypes,
          currentConfig,
        },
      };
    } catch (error) {
      strapi.log.error("Error getting content types:", error);
      ctx.status = 500;
      ctx.body = { error: error.message };
    }
  },

  // 🔧 Update configuration (save permanently to Strapi Store)
  async updateConfig(ctx) {
    try {
      const { contentType, dynamicZoneField } = ctx.request.body;
      
      if (!contentType || !dynamicZoneField) {
        ctx.status = 400;
        ctx.body = { error: 'contentType and dynamicZoneField are required' };
        return;
      }
      
      // Verify that the content type exists
      if (!strapi.contentTypes[contentType]) {
        ctx.status = 400;
        ctx.body = { error: `Content type "${contentType}" not found` };
        return;
      }
      
      // Verify that the dynamic zone field exists
      const attributes = strapi.contentTypes[contentType].attributes || {};
      if (!attributes[dynamicZoneField] || attributes[dynamicZoneField].type !== 'dynamiczone') {
        ctx.status = 400;
        ctx.body = { error: `Dynamic zone field "${dynamicZoneField}" not found in ${contentType}` };
        return;
      }
      
      // Save permanently using Strapi Store API (to database)
      const pluginStore = strapi.store({
        environment: '',
        type: 'plugin',
        name: 'copy-any-component',
      });
      
      await pluginStore.set({
        key: 'settings',
        value: {
          contentType,
          dynamicZoneField,
        },
      });
      
      // Also update runtime config
      strapi.config.set('plugin::copy-any-component.contentType', contentType);
      strapi.config.set('plugin::copy-any-component.dynamicZoneField', dynamicZoneField);
      
      strapi.log.info(`[CopyAnyComponent] Config saved: ${contentType} / ${dynamicZoneField}`);
      
      ctx.body = {
        data: {
          message: 'Configuration saved successfully!',
          contentType,
          dynamicZoneField,
          note: 'This setting has been saved permanently. It will remain valid even after Strapi restarts.',
        },
      };
    } catch (error) {
      strapi.log.error("Error updating config:", error);
      ctx.status = 500;
      ctx.body = { error: error.message };
    }
  },

  async getPages(ctx) {
    try {
      const pluginConfig = strapi.config.get('plugin::copy-any-component') || {};
      const contentType = pluginConfig.contentType || 'api::page.page';
      const dynamicZoneField = pluginConfig.dynamicZoneField || 'sections';
      
      // Check the content type's kind
      const contentTypeModel = strapi.contentTypes[contentType];
      const isSingleType = contentTypeModel?.kind === 'singleType';
      
      let pages;
      if (isSingleType) {
        // Use findOne for SingleType
        try {
          const page = await strapi.entityService.findOne(contentType, {
            populate: [dynamicZoneField],
          });
          pages = page ? [page] : [];
        } catch (error) {
          // If singleType hasn't been created yet, return empty array
          pages = [];
        }
      } else {
        // Use findMany for CollectionType
        pages = await strapi.entityService.findMany(contentType, {
          populate: [dynamicZoneField],
        });
      }
      
      const formattedPages = pages.map((page) => ({
        ...page,
        documentId: page.documentId || page.id,
      }));
      ctx.body = { data: formattedPages };
    } catch (error) {
      strapi.log.error("Error in getPages:", error);
      ctx.status = 500;
      ctx.body = { error: error.message || "Unknown error" };
    }
  },

  async getPageSections(ctx) {
    let { pageId } = ctx.params;
    pageId = decodeURIComponent(pageId);
    
    const pluginConfig = strapi.config.get('plugin::copy-any-component') || {};
    const contentType = pluginConfig.contentType || 'api::page.page';
    const dynamicZoneField = pluginConfig.dynamicZoneField || 'sections';
    
    // Content type'ın kind'ını kontrol et
    const contentTypeModel = strapi.contentTypes[contentType];
    const isSingleType = contentTypeModel?.kind === 'singleType';
    
    let page;
    
    if (isSingleType) {
      // Use findOne directly for SingleType (ID not required)
      try {
        page = await strapi.entityService.findOne(contentType, {
          populate: [dynamicZoneField],
        });
      } catch (error) {
        ctx.status = 404;
        ctx.body = { error: "Page not found: " + pageId, data: null };
        return;
      }
    } else {
      // Find CollectionType by documentId
      const numericId = parseInt(pageId);
      if (!isNaN(numericId)) {
        try {
          page = await strapi.entityService.findOne(contentType, numericId, {
            populate: [dynamicZoneField],
          });
        } catch (error) {
          // Try with documentId
        }
      }
      
      if (!page) {
        try {
          const pages = await strapi.entityService.findMany(contentType, {
            filters: { documentId: pageId },
            populate: [dynamicZoneField],
          });
          page = pages[0];
        } catch (err) {
          ctx.status = 404;
          ctx.body = { error: "Page not found: " + pageId, data: null };
          return;
        }
      }
    }
    
    if (!page) {
      ctx.status = 404;
      ctx.body = { error: "Page not found: " + pageId, data: null };
      return;
    }
    
    ctx.body = {
      error: null,
      data: {
        pageId: page.id,
        documentId: page.documentId,
        pageTitle: getDisplayField(page),
        sections: page[dynamicZoneField] || [],
      },
    };
  },

  async copySections(ctx) {
    let { sourcePageId, targetPageId } = ctx.params;
    const { sectionIndices, insertIndex } = ctx.request.body || {};
    
    strapi.log.info(`[CopySections] Request: sourcePageId=${sourcePageId}, targetPageId=${targetPageId}, sectionIndices=${JSON.stringify(sectionIndices)}, insertIndex=${insertIndex}`);
    
    // Input validation
    if (!sourcePageId || !targetPageId) {
      ctx.status = 400;
      ctx.body = { error: "Source and target page IDs are required", data: null };
      return;
    }

    // Validate sectionIndices if provided
    if (sectionIndices !== undefined && sectionIndices !== null) {
      if (!Array.isArray(sectionIndices)) {
        ctx.status = 400;
        ctx.body = { error: `sectionIndices must be an array, got: ${typeof sectionIndices}`, data: null };
        return;
      }
      const invalidIdx = sectionIndices.find(idx => typeof idx !== 'number' || idx < 0 || !Number.isInteger(idx));
      if (invalidIdx !== undefined) {
        ctx.status = 400;
        ctx.body = { error: `sectionIndices contains invalid value: ${invalidIdx} (type: ${typeof invalidIdx})`, data: null };
        return;
      }
    }
    
    sourcePageId = decodeURIComponent(sourcePageId);
    targetPageId = decodeURIComponent(targetPageId);
    
    const pluginConfig = strapi.config.get('plugin::copy-any-component') || {};
    const contentType = pluginConfig.contentType || 'api::page.page';
    const dynamicZoneField = pluginConfig.dynamicZoneField || 'sections';
    
    // Content type'ın kind'ını kontrol et
    const contentTypeModel = strapi.contentTypes[contentType];
    const isSingleType = contentTypeModel?.kind === 'singleType';
    
    const findPage = async (id) => {
      if (isSingleType) {
        // SingleType için direkt findOne kullan
        try {
          return await strapi.entityService.findOne(contentType, {
            populate: [dynamicZoneField],
          });
        } catch (error) {
          return null;
        }
      }
      
      // Find CollectionType by documentId
      const numericId = parseInt(id);
      if (!isNaN(numericId)) {
        try {
          return await strapi.entityService.findOne(contentType, numericId, {
            populate: [dynamicZoneField],
          });
        } catch (error) {
          // Try with documentId
        }
      }
      
      try {
        const pages = await strapi.entityService.findMany(contentType, {
          filters: { documentId: id },
          populate: [dynamicZoneField],
        });
        return pages[0];
      } catch (err) {
        return null;
      }
    };
    
    const sourcePage = await findPage(sourcePageId);
    const targetPage = await findPage(targetPageId);
    
    if (!sourcePage) {
      ctx.status = 404;
      ctx.body = { error: "Source page not found: " + sourcePageId, data: null };
      return;
    }
    
    if (!targetPage) {
      ctx.status = 404;
      ctx.body = { error: "Target page not found: " + targetPageId, data: null };
      return;
    }
    
    try {
      const service = strapi.plugin("copy-any-component").service("component-copy");
      
      if (!service) {
        ctx.status = 500;
        ctx.body = { error: "Service not found", data: null };
        return;
      }
      
      const result = await service.copySectionsToPage(
        sourcePage.id,
        targetPage.id,
        sectionIndices,
        insertIndex
      );

      strapi.log.info(`[CopySections] Service result: ${JSON.stringify(result?.error || 'success')}`);

      if (result && result.error) {
        strapi.log.error(`[CopySections] Service error: ${result.error}`);
        ctx.status = 400;
        ctx.body = result;
      } else if (result) {
        ctx.body = result;
      } else {
        ctx.status = 500;
        ctx.body = { error: "Service returned null", data: null };
      }
    } catch (error) {
      ctx.status = 500;
      ctx.body = { error: error.message || "An error occurred", data: null };
    }
  },

  async updatePageSections(ctx) {
    let { pageId } = ctx.params;
    const { sections } = ctx.request.body || {};
    
    // Input validation
    if (!pageId) {
      ctx.status = 400;
      ctx.body = { error: "Page ID is required", data: null };
      return;
    }

    if (!sections || !Array.isArray(sections)) {
      ctx.status = 400;
      ctx.body = { error: "Sections array is required", data: null };
      return;
    }

    // Validate sections structure
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (!section || typeof section !== 'object') {
        ctx.status = 400;
        ctx.body = { error: `Section at index ${i} must be an object`, data: null };
        return;
      }
      if (!section.__component) {
        ctx.status = 400;
        ctx.body = { error: `Section at index ${i} must have a __component property`, data: null };
        return;
      }
    }
    
    pageId = decodeURIComponent(pageId);
    
    const pluginConfig = strapi.config.get('plugin::copy-any-component') || {};
    const contentType = pluginConfig.contentType || 'api::page.page';
    const dynamicZoneField = pluginConfig.dynamicZoneField || 'sections';
    
    // Content type'ın kind'ını kontrol et
    const contentTypeModel = strapi.contentTypes[contentType];
    const isSingleType = contentTypeModel?.kind === 'singleType';
    
    const findPage = async (id) => {
      if (isSingleType) {
        // SingleType için direkt findOne kullan
        try {
          return await strapi.entityService.findOne(contentType, {
            populate: [dynamicZoneField],
          });
        } catch (error) {
          return null;
        }
      }
      
      // Find CollectionType by documentId
      const numericId = parseInt(id);
      if (!isNaN(numericId)) {
        try {
          return await strapi.entityService.findOne(contentType, numericId, {
            populate: [dynamicZoneField],
          });
        } catch (error) {
          // Try with documentId
        }
      }
      
      try {
        const pages = await strapi.entityService.findMany(contentType, {
          filters: { documentId: id },
          populate: [dynamicZoneField],
        });
        return pages[0];
      } catch (err) {
        return null;
      }
    };
    
    const page = await findPage(pageId);
    
    if (!page) {
      ctx.status = 404;
      ctx.body = { error: "Page not found: " + pageId, data: null };
      return;
    }

    try {
      const updatedPage = await strapi.entityService.update(contentType, page.id, {
        data: {
          [dynamicZoneField]: sections,
        },
      });

      ctx.body = {
        error: null,
        data: {
          pageId: updatedPage.id,
          pageTitle: getDisplayField(updatedPage),
          sectionsCount: sections.length,
        },
      };
    } catch (error) {
      ctx.status = 500;
      ctx.body = { error: error.message || "An error occurred", data: null };
    }
  },

  async publishPage(ctx) {
    let { pageId } = ctx.params;
    pageId = decodeURIComponent(pageId);
    
    const pluginConfig = strapi.config.get('plugin::copy-any-component') || {};
    const contentType = pluginConfig.contentType || 'api::page.page';
    
    try {
      // In Strapi 5, documentService is used
      // pageId is already a documentId string (sent from frontend)
      const documentService = strapi.documents(contentType);
      const publishedPage = await documentService.publish(pageId);

      ctx.body = {
        error: null,
        data: {
          pageId: publishedPage.id,
          documentId: publishedPage.documentId,
          pageTitle: publishedPage.title || publishedPage.attributes?.title,
          publishedAt: publishedPage.publishedAt,
        },
      };
    } catch (error) {
      strapi.log.error("Publish error:", error);
      ctx.status = 500;
      ctx.body = { error: error.message || "An error occurred while publishing", data: null };
    }
  },
});

module.exports = {
  register({ strapi }) {
    strapi.log.info("📦 Copy Any Component Plugin registered!");
  },
  async bootstrap({ strapi }) {
    strapi.log.info("🚀 Copy Any Component Plugin bootstrapped!");
    
    // Read saved settings from Strapi Store and apply to runtime config
    try {
      const pluginStore = strapi.store({
        environment: '',
        type: 'plugin',
        name: 'copy-any-component',
      });
      
      const savedSettings = await pluginStore.get({ key: 'settings' });
      
      if (savedSettings) {
        strapi.config.set('plugin::copy-any-component.contentType', savedSettings.contentType);
        strapi.config.set('plugin::copy-any-component.dynamicZoneField', savedSettings.dynamicZoneField);
        strapi.log.info(`[CopyAnyComponent] Loaded saved config: ${savedSettings.contentType} / ${savedSettings.dynamicZoneField}`);
      }
    } catch (error) {
      strapi.log.warn("[CopyAnyComponent] Could not load saved settings:", error.message);
    }
    
    const actions = [
      {
        section: "plugins",
        displayName: "Access Component Copy pages",
        uid: "pages.read",
        pluginName: "copy-any-component",
      },
      {
        section: "plugins",
        displayName: "Copy components",
        uid: "copy",
        pluginName: "copy-any-component",
      },
      {
        section: "plugins",
        displayName: "Update page sections",
        uid: "sections.update",
        pluginName: "copy-any-component",
      },
      {
        section: "plugins",
        displayName: "Publish pages",
        uid: "publish",
        pluginName: "copy-any-component",
      },
    ];
    
    strapi.admin.services.permission.actionProvider.registerMany(actions);
  },
  controllers: {
    controller,
  },
  services: {
    "component-copy": componentCopyService,
  },
  routes: {
    "content-api": {
      type: "content-api",
      routes: contentApiRoutes,
    },
    admin: {
      type: "admin",
      routes: [
        {
          method: "GET",
          path: "/content-types",
          handler: "controller.getContentTypes",
          config: {
            policies: [],
          },
        },
        {
          method: "PUT",
          path: "/config",
          handler: "controller.updateConfig",
          config: {
            policies: [],
          },
        },
        {
          method: "GET",
          path: "/pages",
          handler: "controller.getPages",
          config: {
            policies: [],
          },
        },
        {
          method: "GET",
          path: "/pages/:pageId/sections",
          handler: "controller.getPageSections",
          config: {
            policies: [],
          },
        },
        {
          method: "POST",
          path: "/pages/:sourcePageId/copy-to/:targetPageId",
          handler: "controller.copySections",
          config: {
            policies: [],
          },
        },
        {
          method: "PUT",
          path: "/pages/:pageId/sections",
          handler: "controller.updatePageSections",
          config: {
            policies: [],
          },
        },
        {
          method: "POST",
          path: "/pages/:pageId/publish",
          handler: "controller.publishPage",
          config: {
            policies: [],
          },
        },
      ],
    },
  },
};

