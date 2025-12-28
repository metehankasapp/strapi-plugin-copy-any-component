"use strict";

const service = ({ strapi }) => {
  // Get plugin configuration with defaults
  const getConfig = () => {
    const pluginConfig = strapi.config.get('plugin::copy-any-component') || {};
    return {
      contentType: pluginConfig.contentType || 'api::page.page',
      dynamicZoneField: pluginConfig.dynamicZoneField || 'sections',
    };
  };

  const deepCloneSections = (sections) => {
    return JSON.parse(JSON.stringify(sections));
  };

  const isMediaField = (obj) => {
    if (obj && typeof obj === 'object') {
      // If it has __component property, it's a component, not media
      if (obj.__component !== undefined) {
        return false;
      }
      // Media fields have specific properties that distinguish them
      return (
        obj.mime !== undefined ||
        obj.url !== undefined ||
        obj.formats !== undefined ||
        obj.provider !== undefined ||
        (obj.id !== undefined && obj.hash !== undefined && (obj.name !== undefined || obj.alternativeText !== undefined))
      );
    }
    return false;
  };

  const cleanComponent = (component) => {
    if (!component || typeof component !== 'object') {
      return component;
    }

    const cleaned = {};
    
    if (component.__component) {
      cleaned.__component = component.__component;
    }

    const fieldsToRemove = ['id', 'documentId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'publishedAt', 'locale'];
    
    for (const key in component) {
      if (fieldsToRemove.includes(key) || key === '__component') {
        continue;
      }

      const value = component[key];

      if (Array.isArray(value)) {
        cleaned[key] = value.map(item => {
          if (item && typeof item === 'object') {
            // Check if it's a component first (components always have __component property)
            if (item.__component !== undefined) {
              return cleanComponent(item);
            }
            // If it's a media field, keep it as is (just remove entity-specific fields)
            if (isMediaField(item)) {
              const cleanedMedia = {};
              if (item.id !== undefined) cleanedMedia.id = item.id;
              if (item.name !== undefined) cleanedMedia.name = item.name;
              if (item.alternativeText !== undefined) cleanedMedia.alternativeText = item.alternativeText;
              if (item.caption !== undefined) cleanedMedia.caption = item.caption;
              if (item.width !== undefined) cleanedMedia.width = item.width;
              if (item.height !== undefined) cleanedMedia.height = item.height;
              if (item.formats !== undefined) cleanedMedia.formats = item.formats;
              if (item.hash !== undefined) cleanedMedia.hash = item.hash;
              if (item.ext !== undefined) cleanedMedia.ext = item.ext;
              if (item.mime !== undefined) cleanedMedia.mime = item.mime;
              if (item.size !== undefined) cleanedMedia.size = item.size;
              if (item.url !== undefined) cleanedMedia.url = item.url;
              if (item.previewUrl !== undefined) cleanedMedia.previewUrl = item.previewUrl;
              if (item.provider !== undefined) cleanedMedia.provider = item.provider;
              if (item.provider_metadata !== undefined) cleanedMedia.provider_metadata = item.provider_metadata;
              return cleanedMedia;
            }
            // Plain object - just clean it recursively
            return cleanComponent(item);
          }
          return item;
        });
      } else if (value && typeof value === 'object') {
        // Check if it's a component first (components always have __component property)
        if (value.__component !== undefined) {
          cleaned[key] = cleanComponent(value);
        } else if (isMediaField(value)) {
          const cleanedMedia = {};
          if (value.id !== undefined) cleanedMedia.id = value.id;
          if (value.name !== undefined) cleanedMedia.name = value.name;
          if (value.alternativeText !== undefined) cleanedMedia.alternativeText = value.alternativeText;
          if (value.caption !== undefined) cleanedMedia.caption = value.caption;
          if (value.width !== undefined) cleanedMedia.width = value.width;
          if (value.height !== undefined) cleanedMedia.height = value.height;
          if (value.formats !== undefined) cleanedMedia.formats = value.formats;
          if (value.hash !== undefined) cleanedMedia.hash = value.hash;
          if (value.ext !== undefined) cleanedMedia.ext = value.ext;
          if (value.mime !== undefined) cleanedMedia.mime = value.mime;
          if (value.size !== undefined) cleanedMedia.size = value.size;
          if (value.url !== undefined) cleanedMedia.url = value.url;
          if (value.previewUrl !== undefined) cleanedMedia.previewUrl = value.previewUrl;
          if (value.provider !== undefined) cleanedMedia.provider = value.provider;
          if (value.provider_metadata !== undefined) cleanedMedia.provider_metadata = value.provider_metadata;
          cleaned[key] = cleanedMedia;
        } else {
          // Plain object - just clean it recursively
          cleaned[key] = cleanComponent(value);
        }
      } else {
        cleaned[key] = value;
      }
    }
    
    return cleaned;
  };

  // Deep populate helper - Correct format for Strapi
  const buildDeepPopulate = () => {
    // Most effective populate for dynamic zone in Strapi
    return {
      populate: '*'
    };
  };

  // Find display field from content type (title, name, heading, etc.)
  const getDisplayField = (page) => {
    // Check display fields in priority order
    const possibleFields = ['title', 'name', 'heading', 'label', 'displayName', 'slug'];
    for (const field of possibleFields) {
      if (page[field]) return page[field];
    }
    return `ID: ${page.id}`;
  };

  const getPageSections = async (pageId) => {
    try {
      const config = getConfig();
      const page = await strapi.entityService.findOne(config.contentType, pageId, {
        populate: {
          [config.dynamicZoneField]: buildDeepPopulate(),
        },
      });

      if (!page) {
        return { error: "Page not found", data: null };
      }

      return {
        error: null,
        data: {
          pageId: page.id,
          pageTitle: getDisplayField(page),
          sections: page[config.dynamicZoneField] || [],
        },
      };
    } catch (error) {
      return { error: error.message, data: null };
    }
  };

  const analyzeComponentFields = (originalComponent, cleanedComponent) => {
    const fields = [];
    const mediaFields = [];
    const removedFields = [];
    
    const fieldsToRemove = ['id', 'documentId', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'publishedAt', 'locale'];
    
    // Check for removed fields at root level
    for (const field of fieldsToRemove) {
      if (originalComponent[field] !== undefined && cleanedComponent[field] === undefined) {
        removedFields.push({
          path: field,
          type: typeof originalComponent[field],
          value: originalComponent[field],
          reason: 'System field (automatically removed)'
        });
      }
    }
    
    const traverse = (original, cleaned, path = '') => {
      if (!original || typeof original !== 'object') {
        return;
      }

      for (const key in original) {
        if (key === '__component' || key.startsWith('_')) {
          continue;
        }

        const currentPath = path ? `${path}.${key}` : key;
        const originalValue = original[key];
        const cleanedValue = cleaned && typeof cleaned === 'object' ? cleaned[key] : undefined;

        if (originalValue === null || originalValue === undefined) {
          continue;
        }

        // Check if field was removed
        if (cleanedValue === undefined && originalValue !== undefined) {
          removedFields.push({
            path: currentPath,
            type: typeof originalValue,
            value: Array.isArray(originalValue) ? `Array(${originalValue.length})` : 
                   typeof originalValue === 'object' ? 'Object' : originalValue,
            reason: 'Field removed during copy'
          });
          continue;
        }

        if (Array.isArray(originalValue)) {
          if (originalValue.length > 0) {
            if (originalValue[0] && typeof originalValue[0] === 'object' && originalValue[0].id !== undefined) {
              if (originalValue[0].mime || originalValue[0].url || originalValue[0].formats) {
                mediaFields.push({
                  path: currentPath,
                  count: originalValue.length,
                  items: originalValue.map(item => ({
                    id: item.id,
                    name: item.name || item.alternativeText || 'Media',
                    mime: item.mime,
                    url: item.url
                  }))
                });
              } else {
                fields.push({ path: currentPath, type: 'array', count: originalValue.length });
                if (cleanedValue && Array.isArray(cleanedValue)) {
                  originalValue.forEach((item, idx) => {
                    if (item && typeof item === 'object' && cleanedValue[idx]) {
                      traverse(item, cleanedValue[idx], `${currentPath}[${idx}]`);
                    }
                  });
                }
              }
            } else {
              fields.push({ path: currentPath, type: 'array', count: originalValue.length, sample: originalValue[0] });
            }
          }
        } else if (typeof originalValue === 'object') {
          if (originalValue.id !== undefined) {
            if (originalValue.mime || originalValue.url || originalValue.formats) {
              mediaFields.push({
                path: currentPath,
                count: 1,
                items: [{
                  id: originalValue.id,
                  name: originalValue.name || originalValue.alternativeText || 'Media',
                  mime: originalValue.mime,
                  url: originalValue.url
                }]
              });
            } else {
              fields.push({ path: currentPath, type: 'object', value: originalValue.id });
              if (cleanedValue && typeof cleanedValue === 'object') {
                traverse(originalValue, cleanedValue, currentPath);
              }
            }
          } else {
            fields.push({ path: currentPath, type: 'object' });
            if (cleanedValue && typeof cleanedValue === 'object') {
              traverse(originalValue, cleanedValue, currentPath);
            }
          }
        } else {
          const type = typeof originalValue;
          fields.push({ 
            path: currentPath, 
            type: type, 
            value: type === 'string' && originalValue.length > 50 ? originalValue.substring(0, 50) + '...' : originalValue 
          });
        }
      }
    };

    traverse(originalComponent, cleanedComponent);
    
    return { fields, mediaFields, removedFields };
  };

  const copySectionsToPage = async (sourcePageId, targetPageId, sectionIndices = null, insertIndex = null) => {
    try {
      const sourceResult = await getPageSections(sourcePageId);
      if (sourceResult.error) {
        return sourceResult;
      }

      const sourceSections = sourceResult.data.sections || [];

      if (sourceSections.length === 0) {
        return { error: "No sections found in source page", data: null };
      }

      let sectionsToCopy = sourceSections;
      if (sectionIndices && Array.isArray(sectionIndices) && sectionIndices.length > 0) {
        sectionsToCopy = sectionIndices
          .map((index) => sourceSections[index])
          .filter((section) => section !== undefined);
        
        if (sectionsToCopy.length === 0) {
          return { error: "Selected sections not found", data: null };
        }
      }

      const clonedSections = deepCloneSections(sectionsToCopy);
      const cleanedSections = clonedSections.map(section => cleanComponent(section));

      // Analyze copied sections - compare original with cleaned
      const copiedDetails = cleanedSections.map((section, idx) => {
        const originalSection = sectionsToCopy[idx];
        const analysis = analyzeComponentFields(originalSection, section);
        return {
          index: sectionIndices ? sectionIndices[idx] : idx,
          componentType: section.__component || 'unknown',
          fields: analysis.fields,
          mediaFields: analysis.mediaFields,
          removedFields: analysis.removedFields,
          totalFields: analysis.fields.length,
          totalMedia: analysis.mediaFields.reduce((sum, m) => sum + m.count, 0),
          totalRemoved: analysis.removedFields.length
        };
      });

      const config = getConfig();
      const targetPage = await strapi.entityService.findOne(
        config.contentType,
        targetPageId,
        {
        populate: {
          [config.dynamicZoneField]: buildDeepPopulate(),
        },
        }
      );

      if (!targetPage) {
        return { error: "Target page not found", data: null };
      }

      const existingSections = targetPage[config.dynamicZoneField] || [];
      
      // If insertIndex is specified and valid, insert at that position
      // Otherwise, append to the end
      let updatedSections;
      if (insertIndex !== null && insertIndex !== undefined && typeof insertIndex === 'number' && insertIndex >= 0 && insertIndex <= existingSections.length) {
        updatedSections = [...existingSections];
        updatedSections.splice(insertIndex, 0, ...cleanedSections);
      } else {
        updatedSections = [...existingSections, ...cleanedSections];
      }

      const updatedPage = await strapi.entityService.update(
        config.contentType,
        targetPageId,
        {
          data: {
            [config.dynamicZoneField]: updatedSections,
          },
        }
      );

      return {
        error: null,
        data: {
          targetPageId: updatedPage.id,
          targetPageTitle: getDisplayField(updatedPage),
          copiedSectionsCount: cleanedSections.length,
          totalSections: updatedSections.length,
          copiedDetails: copiedDetails,
        },
      };
    } catch (error) {
      return { error: error.message || "Unknown error", data: null };
    }
  };

  return {
    getPageSections,
    copySectionsToPage,
  };
};

module.exports = service;
