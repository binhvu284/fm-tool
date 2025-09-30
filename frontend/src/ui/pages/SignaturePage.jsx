import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Container, Typography, Button, Card, Box, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControl, FormLabel, RadioGroup,
  FormControlLabel, Radio, TextField, Select, MenuItem, Slider,
  ToggleButton, ToggleButtonGroup, Divider, IconButton, Tooltip,
  Alert, AlertTitle, Grid, Paper, List, ListItem, ListItemIcon, ListItemText, Checkbox, Fade
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, DragIndicator as DragIcon,
  FormatBold as BoldIcon, FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon, Security as SecurityIcon,
  Create as CreateIcon, Verified as VerifiedIcon, Info as InfoIcon,
  CheckCircle as CheckCircleIcon,
  ZoomOutMap as ZoomOutMapIcon,
  NavigateBefore as NavigateBeforeIcon,
  NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import http from '../../api/http.js';
// pdf.js local integration (replaces previous CDN dynamic loader)
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerSrc;

export default function SignaturePage() {
  // All files (fetched from backend) and user-chosen queue
  const [files, setFiles] = useState([]); // complete list (or filtered unsigned)
  const [queue, setQueue] = useState([]); // user-selected items only
  const [selectedFile, setSelectedFile] = useState(null);

  // Signature settings
  const [signatureType, setSignatureType] = useState('simple');
  const [signatureFields, setSignatureFields] = useState([]);
  const [nextFieldId, setNextFieldId] = useState(1);

  // Preview state
  const [previewSrc, setPreviewSrc] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  // Multi-page rendering refs
  const inlineContainerRef = useRef(null);
  const expandedContainerRef = useRef(null);
  const inlineCanvasesRef = useRef([]);    // array of canvases for inline view
  const expandedCanvasesRef = useRef([]);  // array of canvases for expanded view
  const pageContainersRef = useRef([]);    // array of per-page container refs for scroll observation
  const [isExpanded, setIsExpanded] = useState(false);
  const [renderScale, setRenderScale] = useState(1.0);
  const [pdfError, setPdfError] = useState(null);
  // Inline preview base scale and viewport height
  const INLINE_SCALE = 1.25; // fixed scale for clarity; container scrolls if needed
  const INLINE_VIEWPORT_HEIGHT = '70vh';
  // Unscaled PDF page sizes (scale=1) per page index
  const [pageSizes, setPageSizes] = useState([]); // [{width, height}] per page

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultUrls, setResultUrls] = useState([]);

  // Dialog states
  const [addFieldDialogOpen, setAddFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [fieldSettings, setFieldSettings] = useState({
    text: 'Digitally signed by [Name]',
    fontSize: 12,
    fontFamily: 'Helvetica',
    bold: false,
    italic: false,
    underline: false,
    color: '#000000',
    width: 200,
    height: 60
  });
  const [selectFileDialogOpen, setSelectFileDialogOpen] = useState(false);
  const [selectToAdd, setSelectToAdd] = useState([]); // ids chosen in dialog

  // Saved queue id list (for initial restore)
  const savedIdsRef = useRef([]);

  // Load saved queue IDs once (before/while fetching files)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sig_queue');
      if (raw) savedIdsRef.current = JSON.parse(raw);
    } catch { }
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const { data } = await http.get('/api/files');
      setFiles(data);
      // If we have saved ids and queue empty -> reconstruct queue
      if (savedIdsRef.current.length && queue.length === 0) {
        const ordered = savedIdsRef.current
          .map(id => data.find(f => f.id === id))
          .filter(Boolean);
        if (ordered.length) setQueue(ordered);
      } else if (queue.length) {
        // Refresh existing queue objects with latest file properties
        setQueue(prev => prev.map(q => data.find(f => f.id === q.id) || q));
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  // Persist queue IDs whenever queue changes
  useEffect(() => {
    try {
      const ids = queue.map(f => f.id);
      localStorage.setItem('sig_queue', JSON.stringify(ids));
    } catch { }
  }, [queue]);

  // Queue management
  const removeFromQueue = (fileId) => {
    setQueue(prev => prev.filter(f => f.id !== fileId));
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
      setPreviewSrc(null);
    }
  };

  // Resolve static preview URL to backend origin if needed
  const resolvePreviewUrl = (raw) => {
    if (!raw) return raw;
    if (/^https?:/i.test(raw)) return raw; // already absolute
    // Env-based base (e.g., http://localhost:3000) optionally provided
    const apiBase = import.meta?.env?.VITE_API_BASE || '';
    if (/^https?:/i.test(apiBase)) {
      // Strip possible /api suffix
      const origin = apiBase.replace(/\/$/, '').replace(/\/api(?:\/.*)?$/, '');
      return origin + raw; // raw should start with /static
    }
    return raw; // hope proxy setup forwards /static
  };

  const selectFile = async (file) => {
    setSelectedFile(file);
    try {
      const response = await http.get(`/api/files/${file.id}/preview`);
      setPdfError(null);
      setPdfDoc(null);
      setPreviewSrc(resolvePreviewUrl(response.data.previewUrl));
    } catch (error) {
      console.error('Failed to generate preview:', error);
      setPdfError('Failed to get preview metadata');
    }
  };

  // Load PDF when previewSrc changes (local pdf.js build)
  useEffect(() => {
    if (!previewSrc) return;
    let cancelled = false;
    (async () => {
      try {
        setPdfError(null);
        let task = getDocument({ url: previewSrc });
        let doc;
        try {
          doc = await task.promise;
        } catch (urlErr) {
          console.warn('Direct PDF URL load failed, attempting ArrayBuffer', urlErr);
          const res = await fetch(previewSrc);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const buf = await res.arrayBuffer();
          task = getDocument({ data: buf });
          doc = await task.promise;
        }
        if (cancelled) return;
        setPdfDoc(doc);
        setPageCount(doc.numPages);
        setCurrentPage(1);
      } catch (e) {
        console.error('PDF load error', e);
        if (!cancelled) setPdfError('Failed to load PDF content');
      }
    })();
    return () => { cancelled = true; };
  }, [previewSrc]);

  // Render helpers: render all pages into a given set of canvases at a given scale
  const renderAllPages = useCallback(async (scale, canvasesRef) => {
    if (!pdfDoc || !pageCount) return;
    const newPageSizes = [];
    for (let i = 1; i <= pageCount; i++) {
      const canvas = canvasesRef.current[i - 1];
      if (!canvas) continue;
      try {
        const page = await pdfDoc.getPage(i);
        const baseViewport = page.getViewport({ scale: 1 });
        newPageSizes[i - 1] = { width: baseViewport.width, height: baseViewport.height };
        const viewport = page.getViewport({ scale });
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (e) {
        console.error('Render page error (page ' + i + ')', e);
      }
    }
    if (newPageSizes.length) setPageSizes(newPageSizes);
  }, [pdfDoc, pageCount]);

  // Initial render for inline view when doc loads or pageCount changes
  useEffect(() => {
    if (!pdfDoc) return;
    renderAllPages(INLINE_SCALE, inlineCanvasesRef);
  }, [pdfDoc, pageCount, renderAllPages]);

  // Re-render expanded view pages on zoom or when expanded opens
  useEffect(() => {
    if (!pdfDoc || !isExpanded) return;
    renderAllPages(renderScale, expandedCanvasesRef);
  }, [pdfDoc, isExpanded, renderScale, pageCount, renderAllPages]);

  // No auto-fit on resize; inline view is scrollable at fixed scale

  const goPage = (delta) => {
    setCurrentPage(p => Math.min(Math.max(p + delta, 1), pageCount));
  };

  // Draggable signature fields
  const dragState = useRef(null);
  const onFieldMouseDown = (e, field) => {
    e.stopPropagation();
    dragState.current = {
      fieldId: field.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: field.x,
      origY: field.y,
      pageIndex: field.page ?? Math.max(0, currentPage - 1)
    };
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragUp);
  };
  const onDragMove = (e) => {
    if (!dragState.current) return;
    e.preventDefault();
    const ds = dragState.current;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    // Convert drag delta from rendered pixels to PDF units using current scale
    const currentScale = isExpanded ? renderScale : INLINE_SCALE;
    const dxf = dx / currentScale;
    const dyf = dy / currentScale;
    setSignatureFields(prev => prev.map(f => {
      if (f.id !== ds.fieldId) return f;
      let newX = ds.origX + dxf;
      let newY = ds.origY + dyf;
      // Clamp within unscaled page bounds
      const pIdx = f.page ?? ds.pageIndex;
      const ps = pageSizes[pIdx] || { width: 0, height: 0 };
      const maxX = Math.max(0, (ps.width || 0) - f.width);
      const maxY = Math.max(0, (ps.height || 0) - f.height);
      newX = Math.min(Math.max(0, newX), maxX);
      newY = Math.min(Math.max(0, newY), maxY);
      return { ...f, x: newX, y: newY };
    }));
  };
  const onDragUp = () => {
    dragState.current = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragUp);
  };
  // Observe inline page visibility to update current page based on scroll position
  useEffect(() => {
    if (!inlineContainerRef.current || pageCount <= 0) return;
    const root = inlineContainerRef.current;
    const observer = new IntersectionObserver((entries) => {
      // Find the most visible page
      let best = { idx: currentPage - 1, ratio: 0 };
      entries.forEach(ent => {
        const idx = Number(ent.target.getAttribute('data-page-idx')) || 0;
        const ratio = ent.intersectionRatio;
        if (ratio > best.ratio) best = { idx, ratio };
      });
      if (best.ratio > 0) setCurrentPage(best.idx + 1);
    }, { root, threshold: Array.from({ length: 11 }, (_, i) => i / 10) });

    pageContainersRef.current.forEach((el) => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [pageCount]);

  // Dialog selection logic
  const availableUnsigned = files.filter(f => !f.hasSignature && !queue.some(q => q.id === f.id));
  const toggleSelectToAdd = (id) => {
    setSelectToAdd(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const confirmAdd = () => {
    if (!selectToAdd.length) { setSelectFileDialogOpen(false); return; }
    const adding = availableUnsigned.filter(f => selectToAdd.includes(f.id));
    setQueue(prev => [...prev, ...adding]);
    if (!selectedFile && adding.length) selectFile(adding[0]);
    setSelectToAdd([]);
    setSelectFileDialogOpen(false);
  };

  // Signature field management
  const addSignatureField = () => {
    const field = {
      id: nextFieldId,
      ...fieldSettings,
      x: 50,
      y: 50,
      page: Math.max(0, currentPage - 1),
      isDragging: false
    };
    setSignatureFields([...signatureFields, field]);
    setNextFieldId(nextFieldId + 1);
    setAddFieldDialogOpen(false);
    resetFieldSettings();
  };

  const removeSignatureField = (fieldId) => {
    setSignatureFields(signatureFields.filter(field => field.id !== fieldId));
  };

  const updateSignatureField = (fieldId, updates) => {
    setSignatureFields(signatureFields.map(field =>
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  };

  const resetFieldSettings = () => {
    setFieldSettings({
      text: 'Digitally signed by [Name]',
      fontSize: 12,
      fontFamily: 'Helvetica',
      bold: false,
      italic: false,
      underline: false,
      color: '#000000',
      width: 200,
      height: 60
    });
  };

  // Apply signatures
  const applySignatures = async () => {
    if (!selectedFile || signatureFields.length === 0) return;

    setIsProcessing(true);
    try {
      // Apply to the current page only to avoid backend page signature errors
      const currentPageIdx = Math.max(0, (currentPage || 1) - 1);
      const payload = {
        fileId: selectedFile.id,
        signatureType,
        fields: signatureFields.map(field => ({
          text: field.text,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          fontSize: field.fontSize,
          fontFamily: field.fontFamily,
          bold: field.bold,
          italic: field.italic,
          underline: field.underline,
          color: field.color,
          // Use field.page if set; fallback to current page index
          page: (typeof field.page === 'number') ? field.page : currentPageIdx
        }))
      };

      const { data } = await http.post('/api/signature/sign', payload);
      setResultUrls(prev => [...prev, data.url]);

      // Refresh file list to reflect signature state (do NOT auto remove from queue)
      await fetchFiles();
      // Update selectedFile reference with new hasSignature state
      setSelectedFile(prev => prev ? (data.url ? (files.find(f => f.id === prev.id) || prev) : prev) : prev);
    } catch (error) {
      console.error('Signature failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Container sx={{ mt: 2 }}>
      {/* Queue Section */}
      <Card sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Queue</Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            size="small"
            onClick={() => setSelectFileDialogOpen(true)}
          >
            ADD
          </Button>
        </Box>

        {/* Queue Items */}
        {queue.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            Queue empty. Click ADD to choose files.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {queue.map((file) => {
              const isActive = selectedFile?.id === file.id;
              const signed = file.hasSignature || file.signatureApplied;
              return (
                <Chip
                  key={file.id}
                  label={file.originalName + (signed ? ' (signed)' : '')}
                  onClick={() => selectFile(file)}
                  onDelete={() => removeFromQueue(file.id)}
                  color={signed ? 'success' : (isActive ? 'primary' : 'default')}
                  variant={isActive || signed ? 'filled' : 'outlined'}
                  size="medium"
                />
              );
            })}
          </Box>
        )}
      </Card>

      <Grid container spacing={3}>
        {/* Signature Settings */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Signature Settings</Typography>

            {/* Signature Type (Enhanced UI) */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Signature Type</Typography>
              <Grid container spacing={1}>
                {[
                  {
                    value: 'simple',
                    title: 'Simple Signature',
                    subtitle: 'Image / drawn signature. Internal use only.',
                    icon: <CreateIcon fontSize="small" />,
                    pill: 'Basic'
                  },
                  {
                    value: 'digital',
                    title: 'Digital Signature',
                    subtitle: 'Certificate-based. eIDAS / ESIGN / UETA compliant.',
                    icon: <VerifiedIcon fontSize="small" />,
                    pill: 'Compliant'
                  }
                ].map(opt => {
                  const active = signatureType === opt.value;
                  return (
                    <Grid item xs={12} key={opt.value}>
                      <Paper
                        elevation={active ? 6 : 1}
                        onClick={() => setSignatureType(opt.value)}
                        sx={{
                          position: 'relative',
                          p: 1.5,
                          pr: 2,
                          borderRadius: 2,
                          cursor: 'pointer',
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: active ? 'primary.main' : 'divider',
                          background: active
                            ? 'linear-gradient(135deg, rgba(25,118,210,0.08), rgba(25,118,210,0.02))'
                            : 'linear-gradient(135deg, rgba(0,0,0,0.02), rgba(0,0,0,0.00))',
                          transition: 'all .25s ease',
                          '&:hover': {
                            boxShadow: 4,
                            borderColor: active ? 'primary.main' : 'primary.light'
                          }
                        }}
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          checked={active}
                          onChange={() => setSignatureType(opt.value)}
                          style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                          aria-label={opt.title}
                        />
                        {active && (
                          <Fade in={active} timeout={250}>
                            <CheckCircleIcon
                              color="primary"
                              sx={{ position: 'absolute', top: 8, right: 8, fontSize: 22 }}
                            />
                          </Fade>
                        )}
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <Box
                            sx={{
                              width: 34,
                              height: 34,
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: active ? 'primary.main' : 'grey.200',
                              color: active ? 'primary.contrastText' : 'text.secondary',
                              flexShrink: 0,
                              boxShadow: active ? 3 : 0,
                              transition: 'all .3s'
                            }}
                          >
                            {opt.icon}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                {opt.title}
                              </Typography>
                              <Chip
                                label={opt.pill}
                                size="small"
                                color={opt.value === 'digital' ? 'success' : 'default'}
                                variant={active ? 'filled' : 'outlined'}
                                sx={{ height: 20, fontSize: 10, fontWeight: 600 }}
                              />
                            </Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: 'block', mt: 0.5, lineHeight: 1.2 }}
                            >
                              {opt.subtitle}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>

            {/* Signature Fields */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="body2" fontWeight={500}>Signature Fields</Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setAddFieldDialogOpen(true)}
                >
                  Add Field
                </Button>
              </Box>

              {signatureFields.length === 0 ? (
                <Typography variant="caption" color="text.secondary">
                  No signature fields added. Click "Add Field" to create one.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {signatureFields.map((field) => (
                    <Paper
                      key={field.id}
                      sx={{
                        p: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        bgcolor: '#f5f5f5'
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DragIcon fontSize="small" />
                        <Typography variant="caption">
                          {field.text.substring(0, 20)}...
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => removeSignatureField(field.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>

            {/* Apply Button */}
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={applySignatures}
              disabled={!selectedFile || signatureFields.length === 0 || isProcessing}
              sx={{ mt: 2 }}
            >
              {isProcessing ? 'Signing...' : 'Sign Document'}
            </Button>
          </Card>
        </Grid>

        {/* Preview Section */}
        <Grid item xs={12} md={8}>
          <Card sx={{ p: 2, position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">Preview</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedFile && (
                  <Typography variant="caption" color="text.secondary">
                    File: {selectedFile.originalName}
                  </Typography>
                )}
                {selectedFile && (
                  <IconButton size="small" onClick={() => setIsExpanded(true)}><ZoomOutMapIcon fontSize="small" /></IconButton>
                )}
              </Box>
            </Box>
            {!selectedFile ? (
              <Box sx={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f5f5f5', borderRadius: 1, border: '2px dashed #ddd' }}>
                <Box sx={{ textAlign: 'center' }}>
                  <InfoIcon sx={{ fontSize: 48, color: '#999', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">Select a file from the queue to preview</Typography>
                </Box>
              </Box>
            ) : pdfError ? (
              <Box sx={{ height: 420, display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'center', justifyContent: 'center', bgcolor: '#fff', border: '1px solid #eee', borderRadius: 1, p: 2 }}>
                <Typography color="error" variant="body2">{pdfError}</Typography>
                {previewSrc && (
                  <Typography variant="caption" sx={{ maxWidth: 360, textAlign: 'center' }}>
                    URL: {previewSrc}
                  </Typography>
                )}
              </Box>
            ) : (
              <Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 1, gap: 1 }}>
                  <IconButton size="small" onClick={() => goPage(-1)} disabled={currentPage <= 1}><NavigateBeforeIcon /></IconButton>
                  <Typography variant="caption">Page {currentPage} / {pageCount}</Typography>
                  <IconButton size="small" onClick={() => goPage(1)} disabled={currentPage >= pageCount}><NavigateNextIcon /></IconButton>
                </Box>
                <Box ref={inlineContainerRef} sx={{ position: 'relative', width: '100%', height: INLINE_VIEWPORT_HEIGHT, overflow: 'auto', display: 'block', bgcolor: '#f5f5f5', borderRadius: 1, p: 2 }}>
                  {Array.from({ length: pageCount }, (_, i) => i).map((i) => (
                    <Box
                      key={i}
                      data-page-idx={i}
                      ref={(el) => { pageContainersRef.current[i] = el; }}
                      sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', mb: 2 }}
                    >
                      <canvas
                        ref={(el) => { inlineCanvasesRef.current[i] = el; }}
                        style={{ borderRadius: 4, background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,0.15)' }}
                      />
                      {signatureFields
                        .filter(field => (typeof field.page === 'number' ? field.page : Math.max(0, currentPage - 1)) === i)
                        .map(field => (
                          <Box key={field.id}
                            onMouseDown={(e) => onFieldMouseDown(e, field)}
                            sx={{ position: 'absolute', left: field.x * INLINE_SCALE, top: field.y * INLINE_SCALE, width: field.width * INLINE_SCALE, height: field.height * INLINE_SCALE, border: '2px solid #1976d2', borderRadius: 1, bgcolor: 'rgba(25,118,210,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'move', fontSize: field.fontSize * INLINE_SCALE, fontFamily: field.fontFamily, fontWeight: field.bold ? 'bold' : 'normal', fontStyle: field.italic ? 'italic' : 'normal', textDecoration: field.underline ? 'underline' : 'none', color: field.color }}
                            onDoubleClick={() => { setEditingField(field); setFieldSettings(field); setAddFieldDialogOpen(true); }}
                          >
                            <Typography variant="caption" sx={{ pointerEvents: 'none', userSelect: 'none' }}>{field.text}</Typography>
                            <IconButton size="small" sx={{ position: 'absolute', top: -8, right: -8, bgcolor: 'white', '&:hover': { bgcolor: 'white' } }} onClick={(e) => { e.stopPropagation(); removeSignatureField(field.id); }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ))}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

      {/* Expanded Preview Dialog */}
      <Dialog open={isExpanded} onClose={() => setIsExpanded(false)} fullScreen>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="subtitle1">Document Preview</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => goPage(-1)} disabled={currentPage <= 1}><NavigateBeforeIcon /></IconButton>
            <Typography variant="caption">Page {currentPage} / {pageCount}</Typography>
            <IconButton size="small" onClick={() => goPage(1)} disabled={currentPage >= pageCount}><NavigateNextIcon /></IconButton>
            <Slider size="small" min={0.5} max={2.5} step={0.1} value={renderScale} onChange={(_, v) => setRenderScale(v)} sx={{ width: 120 }} />
          </Box>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#eee' }}>
          <Box ref={expandedContainerRef} sx={{ position: 'relative', width: '100%', height: '100%', display: 'block', overflow: 'auto', p: 3 }}>
            {Array.from({ length: pageCount }, (_, i) => i).map((i) => (
              <Box key={i} sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', mb: 3 }}>
                <canvas
                  ref={(el) => { expandedCanvasesRef.current[i] = el; }}
                  style={{ background: '#fff', borderRadius: 4, boxShadow: '0 0 6px rgba(0,0,0,0.2)' }}
                />
                {signatureFields
                  .filter(field => (typeof field.page === 'number' ? field.page : Math.max(0, currentPage - 1)) === i)
                  .map(field => (
                    <Box key={field.id}
                      onMouseDown={(e) => onFieldMouseDown(e, field)}
                      sx={{ position: 'absolute', left: field.x * renderScale, top: field.y * renderScale, width: field.width * renderScale, height: field.height * renderScale, border: '2px solid #1976d2', borderRadius: 1, bgcolor: 'rgba(25,118,210,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'move', fontSize: field.fontSize * renderScale, fontFamily: field.fontFamily, fontWeight: field.bold ? 'bold' : 'normal', fontStyle: field.italic ? 'italic' : 'normal', textDecoration: field.underline ? 'underline' : 'none', color: field.color }}
                      onDoubleClick={() => { setEditingField(field); setFieldSettings(field); setAddFieldDialogOpen(true); }}
                    >
                      <Typography variant="caption" sx={{ pointerEvents: 'none', userSelect: 'none' }}>{field.text}</Typography>
                      <IconButton size="small" sx={{ position: 'absolute', top: -10, right: -10, bgcolor: 'white', '&:hover': { bgcolor: 'white' } }} onClick={(e) => { e.stopPropagation(); removeSignatureField(field.id); }}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsExpanded(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Results */}
      {resultUrls.length > 0 && (
        <Card sx={{ p: 2, mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Signed Documents</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {resultUrls.map((url, index) => (
              <Button
                key={index}
                href={url}
                target="_blank"
                variant="outlined"
                size="small"
                sx={{ alignSelf: 'flex-start' }}
              >
                Download Signed PDF #{index + 1}
              </Button>
            ))}
          </Box>
        </Card>
      )}

      {/* Add/Edit Field Dialog */}
      <Dialog
        open={addFieldDialogOpen}
        onClose={() => {
          setAddFieldDialogOpen(false);
          setEditingField(null);
          resetFieldSettings();
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          {editingField ? 'Edit Signature Field' : 'Add Signature Field'}
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            pt: 2,
            '& .MuiFormControl-root': { mt: 0 },
            background: (theme) => theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0))'
              : 'linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0))'
          }}
        >
          <Grid container spacing={3}>
            <Grid item xs={12} md={7}>
              <TextField
                fullWidth
                label="Signature Text"
                value={fieldSettings.text}
                onChange={(e) => setFieldSettings({ ...fieldSettings, text: e.target.value })}
                InputLabelProps={{ shrink: true }}
                helperText={`${fieldSettings.text.length} chars`}
                size="small"
                sx={{ mb: 2, mt: 0.5 }}
              />

              <Divider textAlign="left" sx={{ mb: 2, fontSize: 12, opacity: 0.8 }}>Typography</Divider>
              <Grid container spacing={2} sx={{ mb: 1 }}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <Typography variant="caption" sx={{ fontWeight: 500 }}>Font Family</Typography>
                    <Select
                      value={fieldSettings.fontFamily}
                      onChange={(e) => setFieldSettings({ ...fieldSettings, fontFamily: e.target.value })}
                      size="small"
                      sx={{ mt: 0.5 }}
                    >
                      <MenuItem value="Helvetica">Helvetica</MenuItem>
                      <MenuItem value="Times-Roman">Times Roman</MenuItem>
                      <MenuItem value="Courier">Courier</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>Font Size</Typography>
                  <Slider
                    value={fieldSettings.fontSize}
                    onChange={(_, value) => setFieldSettings({ ...fieldSettings, fontSize: value })}
                    min={8}
                    max={48}
                    step={1}
                    valueLabelDisplay="auto"
                    size="small"
                    sx={{ mt: 1, mx: 1 }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>Style</Typography>
                  <ToggleButtonGroup size="small" sx={{ display: 'flex', mt: 1 }}>
                    <ToggleButton
                      value="bold"
                      selected={fieldSettings.bold}
                      onChange={() => setFieldSettings({ ...fieldSettings, bold: !fieldSettings.bold })}
                    >
                      <BoldIcon fontSize="small" />
                    </ToggleButton>
                    <ToggleButton
                      value="italic"
                      selected={fieldSettings.italic}
                      onChange={() => setFieldSettings({ ...fieldSettings, italic: !fieldSettings.italic })}
                    >
                      <ItalicIcon fontSize="small" />
                    </ToggleButton>
                    <ToggleButton
                      value="underline"
                      selected={fieldSettings.underline}
                      onChange={() => setFieldSettings({ ...fieldSettings, underline: !fieldSettings.underline })}
                    >
                      <UnderlineIcon fontSize="small" />
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>Text Color</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                        background: fieldSettings.color
                      }}
                    />
                    <TextField
                      type="color"
                      size="small"
                      value={fieldSettings.color}
                      onChange={(e) => setFieldSettings({ ...fieldSettings, color: e.target.value })}
                      sx={{ width: 70 }}
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider textAlign="left" sx={{ my: 2, fontSize: 12, opacity: 0.8 }}>Dimensions</Divider>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>Width</Typography>
                  <Slider
                    value={fieldSettings.width}
                    onChange={(_, value) => setFieldSettings({ ...fieldSettings, width: value })}
                    min={100}
                    max={600}
                    step={10}
                    valueLabelDisplay="auto"
                    size="small"
                    sx={{ mt: 1, mx: 1 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" sx={{ fontWeight: 500 }}>Height</Typography>
                  <Slider
                    value={fieldSettings.height}
                    onChange={(_, value) => setFieldSettings({ ...fieldSettings, height: value })}
                    min={30}
                    max={250}
                    step={5}
                    valueLabelDisplay="auto"
                    size="small"
                    sx={{ mt: 1, mx: 1 }}
                  />
                </Grid>
              </Grid>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box
                sx={{
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 1.5,
                  height: '100%',
                  minHeight: 260,
                  background: 'repeating-linear-gradient(45deg, rgba(0,0,0,0.03) 0 10px, transparent 10px 20px)'
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 600, opacity: 0.7 }}>Live Preview</Typography>
                <Box
                  sx={{
                    mt: 1.5,
                    width: fieldSettings.width,
                    height: fieldSettings.height,
                    border: '2px solid',
                    borderColor: 'primary.main',
                    borderRadius: 1,
                    bgcolor: 'rgba(25,118,210,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1,
                    mx: 'auto'
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: fieldSettings.fontSize,
                      fontFamily: fieldSettings.fontFamily,
                      fontWeight: fieldSettings.bold ? 700 : 400,
                      fontStyle: fieldSettings.italic ? 'italic' : 'normal',
                      textDecoration: fieldSettings.underline ? 'underline' : 'none',
                      color: fieldSettings.color,
                      textAlign: 'center'
                    }}
                  >
                    {fieldSettings.text}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setAddFieldDialogOpen(false);
            setEditingField(null);
            resetFieldSettings();
          }}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (editingField) {
                updateSignatureField(editingField.id, fieldSettings);
                setEditingField(null);
              } else {
                addSignatureField();
              }
              setAddFieldDialogOpen(false);
            }}
            variant="contained"
          >
            {editingField ? 'Update' : 'Add'} Field
          </Button>
        </DialogActions>
      </Dialog>

      {/* Select File Dialog */}
      <Dialog
        open={selectFileDialogOpen}
        onClose={() => { setSelectFileDialogOpen(false); setSelectToAdd([]); }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Select uploaded files</DialogTitle>
        <DialogContent dividers>
          {availableUnsigned.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No unsigned files available.
            </Typography>
          ) : (
            <List dense>
              {availableUnsigned.map(file => {
                const checked = selectToAdd.includes(file.id);
                return (
                  <ListItem
                    key={file.id}
                    button
                    onClick={() => toggleSelectToAdd(file.id)}
                    disabled={false}
                  >
                    <ListItemIcon>
                      <Checkbox
                        edge="start"
                        size="small"
                        tabIndex={-1}
                        disableRipple
                        checked={checked}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={file.originalName}
                      secondary={`${(file.size / 1024).toFixed(1)} KB`}
                    />
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setSelectFileDialogOpen(false); setSelectToAdd([]); }}>CANCEL</Button>
          <Button
            variant="contained"
            disabled={!selectToAdd.length}
            onClick={confirmAdd}
          >
            ADD
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
