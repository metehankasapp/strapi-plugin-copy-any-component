import React, { useState, useEffect, useCallback } from "react";
import {
  Main,
  Box,
  SingleSelect,
  SingleSelectOption,
  Typography,
  Alert,
  Flex,
  Badge,
  Button,
  Card,
  Grid,
  IconButton,
} from "@strapi/design-system";
import { Drag, Cross } from "@strapi/icons";
import { Page } from "@strapi/strapi/admin";
import { useFetchClient } from "@strapi/strapi/admin";
import { PLUGIN_ID } from "../pluginId";

const HomePage = () => {
  const [pages, setPages] = useState([]);
  const [sourcePageId, setSourcePageId] = useState("");
  const [targetPageId, setTargetPageId] = useState("");
  const [sourceSections, setSourceSections] = useState([]);
  const [targetSections, setTargetSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSourceSections, setLoadingSourceSections] = useState(false);
  const [loadingTargetSections, setLoadingTargetSections] = useState(false);
  const [message, setMessage] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedSource, setDraggedSource] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverTargetIndex, setDragOverTargetIndex] = useState(null);
  const [copyDetails, setCopyDetails] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [publishing, setPublishing] = useState(false);
  
  // Content Type configuration
  const [contentTypes, setContentTypes] = useState([]);
  const [currentConfig, setCurrentConfig] = useState({ contentType: '', dynamicZoneField: '' });
  const [selectedContentType, setSelectedContentType] = useState('');
  const [selectedDynamicZone, setSelectedDynamicZone] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  
  const { get, post, put } = useFetchClient();

  // Load content types
  useEffect(() => {
    const fetchContentTypes = async () => {
      try {
        const { data } = await get(`/${PLUGIN_ID}/content-types`);
        if (data?.data) {
          setContentTypes(data.data.contentTypes || []);
          setCurrentConfig(data.data.currentConfig || {});
          setSelectedContentType(data.data.currentConfig?.contentType || '');
          setSelectedDynamicZone(data.data.currentConfig?.dynamicZoneField || '');
        }
      } catch (error) {
        console.error("Failed to load content types:", error);
      }
    };
    fetchContentTypes();
  }, [get]);

  // Load pages
  useEffect(() => {
    const fetchPages = async () => {
      try {
        const { data } = await get(`/${PLUGIN_ID}/pages`);
        setPages(data?.data || []);
      } catch (error) {
        setMessage({ type: "danger", text: "Failed to load pages: " + (error.message || "Unknown error") });
      }
    };
    fetchPages();
  }, [get, currentConfig]);
  
  // Update content type configuration
  const handleConfigUpdate = async () => {
    if (!selectedContentType || !selectedDynamicZone) {
      setMessage({ type: "warning", text: "Please select content type and dynamic zone" });
      return;
    }
    
    setConfigLoading(true);
    try {
      const { data } = await put(`/${PLUGIN_ID}/config`, {
        contentType: selectedContentType,
        dynamicZoneField: selectedDynamicZone,
      });
      
      if (data?.data) {
        setCurrentConfig({
          contentType: selectedContentType,
          dynamicZoneField: selectedDynamicZone,
        });
        setMessage({ type: "success", text: "Configuration updated! Pages are reloading..." });
        
        // Reload pages
        const pagesRes = await get(`/${PLUGIN_ID}/pages`);
        setPages(pagesRes.data?.data || []);
        setSourcePageId("");
        setTargetPageId("");
        setSourceSections([]);
        setTargetSections([]);
        setShowSettings(false);
      }
    } catch (error) {
      setMessage({ type: "danger", text: "Failed to update configuration: " + (error.message || "Unknown error") });
    } finally {
      setConfigLoading(false);
    }
  };
  
  // Get dynamic zones based on selected content type
  const getAvailableDynamicZones = () => {
    const ct = contentTypes.find(c => c.uid === selectedContentType);
    return ct?.dynamicZones || [];
  };

  useEffect(() => {
    if (sourcePageId) {
      loadSourceSections();
    } else {
      setSourceSections([]);
    }
  }, [sourcePageId]);

  useEffect(() => {
    if (targetPageId) {
      loadTargetSections();
      setHasUnsavedChanges(false);
    } else {
      setTargetSections([]);
      setHasUnsavedChanges(false);
    }
  }, [targetPageId]);

  const loadSourceSections = useCallback(async () => {
    setLoadingSourceSections(true);
    try {
      const { data } = await get(
        `/${PLUGIN_ID}/pages/${encodeURIComponent(sourcePageId)}/sections`
      );
      if (data.error) {
        setMessage({ type: "danger", text: data.error });
        setSourceSections([]);
      } else {
        setSourceSections(data.data.sections || []);
      }
    } catch (error) {
      setMessage({ type: "danger", text: "Failed to load sections: " + (error.message || "Unknown error") });
      setSourceSections([]);
    } finally {
      setLoadingSourceSections(false);
    }
  }, [sourcePageId, get]);

  const loadTargetSections = useCallback(async () => {
    setLoadingTargetSections(true);
    try {
      const { data } = await get(
        `/${PLUGIN_ID}/pages/${encodeURIComponent(targetPageId)}/sections`
      );
      if (data.error) {
        setTargetSections([]);
      } else {
        setTargetSections(data.data.sections || []);
      }
    } catch (error) {
      setTargetSections([]);
    } finally {
      setLoadingTargetSections(false);
    }
  }, [targetPageId, get]);

  const handleDragStart = useCallback((e, index, source = 'source') => {
    setDraggedIndex(index);
    setDraggedSource(source);
    e.dataTransfer.effectAllowed = source === 'source' ? "copy" : "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ index, source }));
    
    const dragImage = e.target.cloneNode(true);
    dragImage.style.opacity = "0.8";
    dragImage.style.position = "absolute";
    dragImage.style.top = "-1000px";
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDraggedSource(null);
    setIsDragOver(false);
    setDragOverTargetIndex(null);
  }, []);

  const handleDragOver = useCallback((e, targetIndex = null) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = draggedSource === 'source' ? "copy" : "move";
    setIsDragOver(true);
    if (targetIndex !== null) {
      setDragOverTargetIndex(targetIndex);
    }
  }, [draggedSource]);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDragOver(false);
      setDragOverTargetIndex(null);
    }
  }, []);

  const handleDrop = useCallback(async (e, dropIndex = null) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    setDragOverTargetIndex(null);

    const dataStr = e.dataTransfer.getData("text/plain");
    let dragData;
    try {
      dragData = JSON.parse(dataStr);
    } catch {
      const index = parseInt(dataStr, 10);
      if (isNaN(index)) return;
      dragData = { index, source: 'source' };
    }

    const { index, source } = dragData;

    if (source === 'target' && dropIndex !== null && targetPageId) {
      if (index === dropIndex) {
        return;
      }

      const newSections = [...targetSections];
      const [movedSection] = newSections.splice(index, 1);
      newSections.splice(dropIndex, 0, movedSection);
      
      setTargetSections(newSections);
      setHasUnsavedChanges(true);
      setDraggedIndex(null);
      setDraggedSource(null);
      return;
    }

    if (!sourcePageId || !targetPageId) {
      setMessage({ type: "danger", text: "Please select both source and target pages" });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { data } = await post(
        `/${PLUGIN_ID}/pages/${encodeURIComponent(sourcePageId)}/copy-to/${encodeURIComponent(targetPageId)}`,
        { sectionIndices: [index], insertIndex: dropIndex }
      );

      if (data.error) {
        setMessage({ type: "danger", text: data.error });
        setCopyDetails(null);
      } else {
        const isDuplicate = sourcePageId === targetPageId;
        setMessage({
          type: "success",
          text: `Successfully ${isDuplicate ? 'duplicated' : 'copied'} ${data.data.copiedSectionsCount} section(s)! Click to view details.`,
        });
        setCopyDetails(data.data.copiedDetails || []);
        setHasUnsavedChanges(true);
        setShowDetailsModal(true);
        
        await loadTargetSections();
        if (isDuplicate) {
          await loadSourceSections();
        }
      }
    } catch (error) {
      setMessage({
        type: "danger",
        text: error.message || "An error occurred",
      });
    } finally {
      setLoading(false);
      setDraggedIndex(null);
      setDraggedSource(null);
    }
  }, [sourcePageId, targetPageId, targetSections, post, put, loadTargetSections, loadSourceSections]);

  const getPageTitle = (page) => {
    // Different content types may have different field names
    return page.attributes?.title || page.title || 
           page.attributes?.name || page.name ||
           page.attributes?.heading || page.heading ||
           page.attributes?.label || page.label ||
           page.attributes?.slug || page.slug ||
           `ID: ${page.id}`;
  };

  const handlePublish = useCallback(async () => {
    if (!targetPageId || !hasUnsavedChanges) {
      return;
    }

    setPublishing(true);
    setMessage(null);

    try {
      const { data: updateData } = await put(
        `/${PLUGIN_ID}/pages/${encodeURIComponent(targetPageId)}/sections`,
        { sections: targetSections }
      );

      if (updateData.error) {
        setMessage({ type: "danger", text: updateData.error });
        setPublishing(false);
        return;
      }

      const { data: publishData } = await post(
        `/${PLUGIN_ID}/pages/${encodeURIComponent(targetPageId)}/publish`
      );

      if (publishData.error) {
        setMessage({ type: "danger", text: publishData.error });
      } else {
        setMessage({
          type: "success",
          text: "Page published successfully!",
        });
        setHasUnsavedChanges(false);
        await loadTargetSections();
      }
    } catch (error) {
      setMessage({
        type: "danger",
        text: error.message || "An error occurred while publishing",
      });
    } finally {
      setPublishing(false);
    }
  }, [targetPageId, targetSections, hasUnsavedChanges, put, post, loadTargetSections]);

  const getComponentName = (section) => {
    const componentType = section.__component || "";
    return componentType.replace("sections.", "").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
  };

  const getComponentPreview = (section) => {
    return section.title ||
      section.heading ||
      section.text?.substring(0, 40) ||
      section.content?.substring(0, 40) ||
      "No content";
  };

  return (
    <Page.Main>
      <Page.Title>Copy Any Component 🎨</Page.Title>
      <Main>
        <Box padding={8}>
          <Flex justifyContent="space-between" alignItems="flex-start" marginBottom={6}>
            <Box>
              <Typography variant="alpha" tag="h1">
                Copy Any Component 🎨
              </Typography>
              <Typography variant="omega" textColor="neutral600" marginTop={2}>
                Drag any component from source page to target page - Works with all component types!
              </Typography>
              {currentConfig.contentType && (
                <Flex gap={2} marginTop={2}>
                  <Badge>
                    {contentTypes.find(c => c.uid === currentConfig.contentType)?.displayName || currentConfig.contentType}
                  </Badge>
                  <Badge variant="secondary">
                    {currentConfig.dynamicZoneField}
                  </Badge>
                </Flex>
              )}
            </Box>
            <Button 
              variant={showSettings ? "secondary" : "tertiary"} 
              onClick={() => setShowSettings(!showSettings)}
              size="S"
            >
              ⚙️ {showSettings ? "Close Settings" : "Content Type Settings"}
            </Button>
          </Flex>
          
          {/* Content Type Settings */}
          {showSettings && (
            <Box marginBottom={6} padding={4} background="neutral100" hasRadius>
              <Typography variant="beta" tag="h3" marginBottom={4}>
                📋 Content Type Configuration
              </Typography>
              <Typography variant="omega" textColor="neutral600" marginBottom={4}>
                Select below to use a different content type or dynamic zone. 
                Your settings are <strong>automatically saved</strong> and will persist even after Strapi restarts. 
                No code editing required! ✨
              </Typography>
              
              {contentTypes.length === 0 ? (
                <Alert variant="warning" title="Warning">
                  No content types with dynamic zones found. Please create a content type first.
                </Alert>
              ) : (
                <Grid.Root gap={4}>
                  <Grid.Item col={5} s={12}>
                    <Box>
                      <Typography variant="sigma" textColor="neutral700" marginBottom={2}>
                        Content Type
                      </Typography>
                      <SingleSelect
                        value={selectedContentType}
                        onChange={val => {
                          setSelectedContentType(val);
                          // Automatically select the first dynamic zone
                          const ct = contentTypes.find(c => c.uid === val);
                          if (ct?.dynamicZones?.length > 0) {
                            setSelectedDynamicZone(ct.dynamicZones[0].name);
                          } else {
                            setSelectedDynamicZone('');
                          }
                        }}
                        placeholder="Select content type..."
                      >
                        {contentTypes.map(ct => (
                          <SingleSelectOption key={ct.uid} value={ct.uid}>
                            {ct.displayName} ({ct.kind === 'collectionType' ? 'Collection' : 'Single'})
                          </SingleSelectOption>
                        ))}
                      </SingleSelect>
                    </Box>
                  </Grid.Item>
                  
                  <Grid.Item col={4} s={12}>
                    <Box>
                      <Typography variant="sigma" textColor="neutral700" marginBottom={2}>
                        Dynamic Zone Field
                      </Typography>
                      <SingleSelect
                        value={selectedDynamicZone}
                        onChange={setSelectedDynamicZone}
                        placeholder="Select dynamic zone..."
                        disabled={!selectedContentType}
                      >
                        {getAvailableDynamicZones().map(dz => (
                          <SingleSelectOption key={dz.name} value={dz.name}>
                            {dz.name} ({dz.components.length} component)
                          </SingleSelectOption>
                        ))}
                      </SingleSelect>
                    </Box>
                  </Grid.Item>
                  
                  <Grid.Item col={3} s={12}>
                    <Box>
                      <Typography variant="sigma" textColor="neutral700" marginBottom={2}>
                        &nbsp;
                      </Typography>
                      <Button 
                        onClick={handleConfigUpdate} 
                        loading={configLoading}
                        disabled={!selectedContentType || !selectedDynamicZone || 
                          (selectedContentType === currentConfig.contentType && 
                           selectedDynamicZone === currentConfig.dynamicZoneField)}
                        fullWidth
                      >
                        💾 Save
                      </Button>
                    </Box>
                  </Grid.Item>
                </Grid.Root>
              )}
              
              {contentTypes.length > 0 && (
                <Box marginTop={4} padding={3} background="neutral0" hasRadius>
                  <Typography variant="sigma" textColor="neutral700" marginBottom={2}>
                    💡 Available Content Types and Dynamic Zones:
            </Typography>
                  <Box style={{ maxHeight: '150px', overflowY: 'auto' }}>
                    {contentTypes.map(ct => (
                      <Flex key={ct.uid} gap={2} marginBottom={1} alignItems="center">
                        <Badge variant={ct.uid === currentConfig.contentType ? "success" : "secondary"}>
                          {ct.displayName}
                        </Badge>
                        <Typography variant="omega" textColor="neutral600">
                          → {ct.dynamicZones.map(dz => dz.name).join(', ')}
            </Typography>
                      </Flex>
                    ))}
          </Box>
                </Box>
              )}
            </Box>
          )}

          {message && (
            <Box marginBottom={6}>
              <Alert
                closeLabel="Close"
                title={message.type === "success" ? "Success" : "Error"}
                variant={message.type === "success" ? "success" : "danger"}
                onClose={() => {
                  setMessage(null);
                  setCopyDetails(null);
                }}
                onClick={() => {
                  if (message.type === "success" && copyDetails) {
                    setShowDetailsModal(true);
                  }
                }}
                style={{ cursor: message.type === "success" && copyDetails ? "pointer" : "default" }}
              >
                {message.text}
              </Alert>
            </Box>
          )}

          {showDetailsModal && copyDetails && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
              }}
              onClick={() => setShowDetailsModal(false)}
            >
              <Card
                style={{
                  maxWidth: "800px",
                  width: "100%",
                  maxHeight: "90vh",
                  display: "flex",
                  flexDirection: "column",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <Box
                  padding={4}
                  borderColor="neutral200"
                  style={{
                    borderBottom: "1px solid",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography fontWeight="bold" variant="beta" as="h2">
                    Copy Details
                  </Typography>
                  <IconButton
                    variant="ghost"
                    onClick={() => setShowDetailsModal(false)}
                    label="Close"
                  >
                    <Cross />
                  </IconButton>
                </Box>
                <Box
                  padding={4}
                  style={{
                    overflowY: "auto",
                    flex: 1,
                  }}
                >
                  {copyDetails.map((detail, idx) => (
                    <Box key={idx} marginBottom={6}>
                      <Card>
                        <Box padding={4}>
                          <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
                        <Typography variant="beta" fontWeight="bold">
                          {detail.componentType.replace("sections.", "").replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </Typography>
                            <Flex gap={2}>
                              <Badge>
                          {detail.totalFields} fields • {detail.totalMedia} media
                        </Badge>
                              {detail.totalRemoved > 0 && (
                                <Badge variant="secondary">
                                  {detail.totalRemoved} system
                                </Badge>
                              )}
                            </Flex>
                      </Flex>

                      {detail.mediaFields.length > 0 && (
                        <Box marginBottom={4}>
                          <Typography variant="sigma" textColor="neutral700" marginBottom={2}>
                            📷 Media Files ({detail.totalMedia}):
                          </Typography>
                          {detail.mediaFields.map((media, mIdx) => (
                                <Box key={mIdx} padding={3} marginBottom={2} background="neutral100" hasRadius>
                              <Typography variant="omega" fontWeight="bold" marginBottom={1}>
                                {media.path}:
                              </Typography>
                              {media.items.map((item, iIdx) => (
                                    <Box key={iIdx} padding={2} marginTop={1} background="neutral0" hasRadius>
                                  <Flex alignItems="center" gap={2}>
                                    <Typography variant="omega" textColor="success600">
                                      ✓
                                    </Typography>
                                    <Box>
                                      <Typography variant="omega" fontWeight="semiBold">
                                        {item.name}
                                      </Typography>
                                      <Typography variant="omega" textColor="neutral600" fontSize={1}>
                                        {item.mime} • ID: {item.id}
                                      </Typography>
                                    </Box>
                                  </Flex>
                                </Box>
                              ))}
                            </Box>
                          ))}
                        </Box>
                      )}

                      {detail.fields.length > 0 && (
                            <Box marginBottom={4}>
                          <Typography variant="sigma" textColor="neutral700" marginBottom={2}>
                            📝 Fields ({detail.totalFields}):
                          </Typography>
                          <Box style={{ maxHeight: "300px", overflowY: "auto" }}>
                            {detail.fields.slice(0, 20).map((field, fIdx) => (
                              <Box key={fIdx} padding={2} marginBottom={1} background="neutral0" hasRadius>
                                <Flex alignItems="center" gap={2}>
                                  <Typography variant="omega" textColor="success600">
                                    ✓
                                  </Typography>
                                  <Box style={{ flex: 1 }}>
                                    <Typography variant="omega" fontWeight="semiBold">
                                      {field.path}
                                    </Typography>
                                    <Typography variant="omega" textColor="neutral600" fontSize={1}>
                                      Type: {field.type}
                                      {field.value !== undefined && ` • Value: ${String(field.value).substring(0, 50)}`}
                                      {field.count !== undefined && ` • Count: ${field.count}`}
                                    </Typography>
                                  </Box>
                                </Flex>
                              </Box>
                            ))}
                            {detail.fields.length > 20 && (
                              <Typography variant="omega" textColor="neutral600" marginTop={2}>
                                ... and {detail.fields.length - 20} more fields
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      )}

                          {detail.removedFields && detail.removedFields.length > 0 && (
                            <Box>
                              <Flex alignItems="center" gap={2} marginBottom={2}>
                                <Typography variant="sigma" textColor="neutral600">
                                  ℹ️ System Fields ({detail.totalRemoved}):
                                </Typography>
                                <Badge variant="secondary" size="S">Auto-handled</Badge>
                              </Flex>
                              <Box padding={3} background="neutral100" hasRadius marginBottom={2}>
                                <Typography variant="omega" textColor="neutral600" style={{ fontSize: '12px' }}>
                                  💡 The following fields are automatically managed. IDs are removed and Strapi creates new unique IDs. This is normal behavior and does not cause data loss.
                                </Typography>
                              </Box>
                              <Box style={{ maxHeight: "150px", overflowY: "auto" }}>
                                {detail.removedFields.map((field, rIdx) => (
                                  <Box key={rIdx} padding={2} marginBottom={1} background="neutral100" hasRadius>
                                    <Flex alignItems="center" gap={2}>
                                      <Typography variant="omega" textColor="neutral500">
                                        →
                                      </Typography>
                                      <Box style={{ flex: 1 }}>
                                        <Typography variant="omega" fontWeight="semiBold" textColor="neutral700">
                                          {field.path}
                                        </Typography>
                                        <Typography variant="omega" textColor="neutral500" style={{ fontSize: '11px' }}>
                                          {field.reason === 'System field (automatically removed)' 
                                            ? 'System field - New ID will be assigned' 
                                            : 'Nested ID - Will be automatically created'}
                                        </Typography>
                                      </Box>
                                    </Flex>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          )}

                      {detail.fields.length === 0 && detail.mediaFields.length === 0 && (
                        <Typography variant="omega" textColor="neutral600">
                          No fields detected in this component
                        </Typography>
                      )}
                        </Box>
                      </Card>
                    </Box>
                  ))}
                </Box>
                <Box
                  padding={4}
                  borderColor="neutral200"
                  style={{
                    borderTop: "1px solid",
                    display: "flex",
                    justifyContent: "flex-end",
                  }}
                >
                  <Button onClick={() => setShowDetailsModal(false)} variant="tertiary">
                    Close
                  </Button>
                </Box>
              </Card>
            </div>
          )}

          <Grid.Root gap={4}>
            <Grid.Item col={6} xs={12}>
              <Card style={{ height: "100%",width: "100%" }}> 
                <Box padding={4}>
                  <Typography variant="delta" tag="h2" marginBottom={4}>
                Source Page
              </Typography>
              
              <Box marginBottom={4}>
                <SingleSelect
                  label="Select source page"
                  placeholder="Choose page..."
                  value={sourcePageId}
                  onChange={setSourcePageId}
                >
                  {pages.map((page) => {
                    const pageId = page.documentId || page.id;
                    return (
                      <SingleSelectOption key={pageId} value={pageId}>
                        {getPageTitle(page)}
                      </SingleSelectOption>
                    );
                  })}
                </SingleSelect>
              </Box>

                  <Box
                    style={{
                      minHeight: "400px",
                      maxHeight: "600px",
                      overflowY: "auto",
                    }}
                    padding={3}
                    background="neutral100"
                    hasRadius
                  >
                {loadingSourceSections ? (
                      <Typography>Loading...</Typography>
                ) : sourceSections.length > 0 ? (
                  <>
                        <Typography variant="sigma" textColor="neutral600" marginBottom={3}>
                      {sourceSections.length} SECTION(S) • DRAG TO COPY →
                    </Typography>
                    {sourceSections.map((section, index) => (
                          <Card
                        key={index}
                            style={{
                              cursor: "grab",
                              opacity: draggedIndex === index && draggedSource === 'source' ? 0.5 : 1,
                              marginBottom: 3,
                            }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index, 'source')}
                        onDragEnd={handleDragEnd}
                      >
                            <Box padding={3}>
                        <Flex justifyContent="space-between" alignItems="center">
                                <Box style={{ flex: 1 }}>
                                  <Badge>
                              {getComponentName(section)}
                            </Badge>
                                  <Typography variant="omega" marginTop={2} tag="p">
                              {getComponentPreview(section)}
                            </Typography>
                          </Box>
                                <IconButton
                                  variant="ghost"
                                  onClick={(e) => e.preventDefault()}
                                  label="Drag"
                                  noBorder
                                >
                                  <Drag />
                                </IconButton>
                        </Flex>
                            </Box>
                          </Card>
                    ))}
                  </>
                ) : sourcePageId ? (
                      <Typography textColor="neutral600">No sections in this page</Typography>
                    ) : (
                      <Typography textColor="neutral600">Select a source page</Typography>
                    )}
                  </Box>
                </Box>
              </Card>
            </Grid.Item>

            <Grid.Item col={6} xs={12}>
              <Card style={{ height: "100%",width: "100%" }}>
                <Box padding={4}>
              <Flex justifyContent="space-between" alignItems="center" marginBottom={4}>
                    <Typography variant="delta" tag="h2">
                  Target Page
                </Typography>
                {hasUnsavedChanges && targetPageId && (
                  <Button
                    onClick={handlePublish}
                    loading={publishing}
                    variant="default"
                    size="S"
                  >
                    Publish
                  </Button>
                )}
              </Flex>
              
              {hasUnsavedChanges && (
                    <Box marginBottom={4} padding={3} background="warning100" hasRadius>
                  <Typography variant="omega" textColor="warning700">
                    ⚠️ You have unsaved changes. Click Publish to save and publish.
                  </Typography>
                </Box>
              )}
              
              <Box marginBottom={4}>
                <SingleSelect
                  label="Select target page"
                  placeholder="Choose page..."
                  value={targetPageId}
                  onChange={setTargetPageId}
                >
                  {pages.map((page) => {
                    const pageId = page.documentId || page.id;
                    return (
                      <SingleSelectOption key={pageId} value={pageId}>
                        {getPageTitle(page)}
                      </SingleSelectOption>
                    );
                  })}
                </SingleSelect>
              </Box>

                  <Box
                    padding={3}
                    background={isDragOver ? "primary100" : "neutral100"}
                    hasRadius
                    style={{
                      minHeight: "400px",
                      maxHeight: "600px",
                      overflowY: "auto",
                      border: isDragOver ? "2px dashed" : "2px dashed transparent",
                      borderColor: isDragOver ? "primary500" : "transparent",
                    }}
                onDragOver={(e) => {
                  if (draggedSource === 'source') {
                    handleDragOver(e);
                  }
                }}
                onDragLeave={handleDragLeave}
                onDrop={(e) => {
                  if (draggedSource === 'source') {
                    handleDrop(e, targetSections.length);
                  }
                }}
              >
                {loadingTargetSections ? (
                      <Typography>Loading...</Typography>
                ) : (
                  <>
                    {targetSections.length > 0 && (
                          <Typography variant="sigma" textColor="neutral600" marginBottom={3}>
                        {targetSections.length} SECTION(S) • Drag to reorder
                      </Typography>
                    )}
                    
                    {targetSections.map((section, index) => (
                      <React.Fragment key={index}>
                        {dragOverTargetIndex === index && (
                              <Box
                            style={{
                              height: "4px",
                                  backgroundColor: "primary500",
                                  marginBottom: 2,
                              borderRadius: "2px",
                            }}
                          />
                        )}
                            <Card
                          style={{
                            cursor: draggedSource === 'target' ? "move" : "default",
                            opacity: draggedIndex === index && draggedSource === 'target' ? 0.5 : 1,
                                marginBottom: 3,
                          }}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, index, 'target')}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, index)}
                        >
                              <Box padding={3}>
                          <Flex justifyContent="space-between" alignItems="flex-start">
                            <Box style={{ flex: 1 }}>
                                    <Badge variant="secondary">
                                {getComponentName(section)}
                              </Badge>
                                    <Typography variant="omega" marginTop={2} tag="p">
                                {getComponentPreview(section)}
                              </Typography>
                            </Box>
                                  <IconButton
                                    variant="ghost"
                                    onClick={(e) => e.preventDefault()}
                                    label="Drag"
                                    noBorder
                                  >
                                    <Drag />
                                  </IconButton>
                          </Flex>
                              </Box>
                            </Card>
                      </React.Fragment>
                    ))}
                    
                    {dragOverTargetIndex === targetSections.length && (
                          <Box
                        style={{
                          height: "4px",
                              backgroundColor: "primary500",
                              marginTop: 2,
                          borderRadius: "2px",
                        }}
                      />
                    )}

                        {isDragOver && targetSections.length === 0 && (
                          <Box padding={8} textAlign="center">
                            <Typography variant="omega" textColor="primary600">
                          ↓ Drop here to copy section ↓
                        </Typography>
                          </Box>
                    )}

                    {!isDragOver && targetSections.length === 0 && targetPageId && (
                          <Box padding={8} textAlign="center">
                            <Typography variant="omega" textColor="neutral600">
                          No sections yet. Drag from source to add.
                        </Typography>
                          </Box>
                    )}

                    {!targetPageId && (
                          <Typography textColor="neutral600">Select a target page</Typography>
                    )}
                  </>
                )}
                  </Box>
                </Box>
              </Card>
            </Grid.Item>
          </Grid.Root>
        </Box>
      </Main>
    </Page.Main>
  );
};

export default HomePage;
