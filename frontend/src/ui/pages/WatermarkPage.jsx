import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Container, Typography, TextField, Slider, Button, Box, Card, MenuItem, Grid, Chip, Stack, ToggleButtonGroup, ToggleButton, Divider, Checkbox, FormControlLabel, Tooltip, Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemIcon, ListItemText, Backdrop, CircularProgress, Popover, Link } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import http from '../../api/http.js';

export default function WatermarkPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const initialId = params.get('fileId') || '';
  const [files, setFiles] = useState([]);
  const [fileId, setFileId] = useState(initialId);
  const [queue, setQueue] = useState([]); // array of ids
  const [addOpen, setAddOpen] = useState(false);
  const [selectToAdd, setSelectToAdd] = useState([]);
  const [mode, setMode] = useState('text'); // 'text' | 'image'
  // text settings
  const [text, setText] = useState('CONFIDENTIAL');
  const [font, setFont] = useState('Helvetica');
  const [bold, setBold] = useState(true);
  const [underline, setUnderline] = useState(false);
  const [fontSize, setFontSize] = useState(20); // default size 20
  const [color, setColor] = useState('#000000'); // default black
  // shared settings
  const [opacity, setOpacity] = useState(25);
  const [rotate, setRotate] = useState(0);
  const [position, setPosition] = useState('top-left');
  const [mosaic, setMosaic] = useState(false);
  // image settings
  const [imageData, setImageData] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageSize, setImageSize] = useState(50); // Image size as percentage
  const [resultUrls, setResultUrls] = useState([]);
  const [previewSrc, setPreviewSrc] = useState(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [colorAnchor, setColorAnchor] = useState(null); // popover anchor
  const colorInputRef = useRef(null);
  const presetColors = ['#000000', '#ffffff', '#ff0000', '#00a3ff', '#ff9900', '#00aa55', '#8000ff'];
  const fileIdRef = useRef(fileId);
  useEffect(() => { fileIdRef.current = fileId; }, [fileId]);

  // Reset to default settings
  const resetToDefaults = () => {
    setText('CONFIDENTIAL');
    setFont('Helvetica');
    setBold(true);
    setUnderline(false);
    setFontSize(20);
    setColor('#000000');
    setOpacity(25);
    setRotate(0);
    setPosition('top-left');
    setMosaic(false);
    setImageData(null);
    setImagePreview(null);
    setImageSize(50);
    setPreviewSrc(null);
  };

  // Load files + restore queue from localStorage
  useEffect(() => {
    (async () => {
      try { const { data } = await http.get('/api/files'); setFiles(data); } catch { }
    })();
  }, []);

  // Restore queue once on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('wm_queue') || '[]');
      if (Array.isArray(saved) && saved.length) {
        setQueue(saved.map(String));
        if (!fileId) setFileId(String(saved[0]));
      }
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist queue whenever it changes
  useEffect(() => {
    try { localStorage.setItem('wm_queue', JSON.stringify(queue)); } catch { }
  }, [queue]);

  // Listen for external deletions (from Dashboard) and remove from queue
  useEffect(() => {
    const handler = (e) => {
      const ids = e.detail?.ids || [];
      if (!ids.length) return;
      setQueue(q => {
        const filtered = q.filter(id => !ids.includes(String(id)));
        if (filtered.length !== q.length) {
          try { localStorage.setItem('wm_queue', JSON.stringify(filtered)); } catch { }
          if (!filtered.includes(fileIdRef.current)) {
            // adjust selected file
            const next = filtered[0] || '';
            if (fileIdRef.current !== next) {
              setFileId(next);
              setPreviewSrc(null);
            }
          }
        }
        return filtered;
      });
    };
    window.addEventListener('wm-files-deleted', handler);
    return () => window.removeEventListener('wm-files-deleted', handler);
  }, []);

  const reloadFiles = async () => { try { const { data } = await http.get('/api/files'); setFiles(data); } catch { } };

  const selected = useMemo(() => files.find((f) => String(f.id) === String(fileId)), [files, fileId]);

  const removeFromQueue = (id) => setQueue((q) => q.filter((x) => x !== id));
  const openAddDialog = () => { setSelectToAdd([]); setAddOpen(true); };
  const closeAddDialog = () => setAddOpen(false);
  const toggleSelect = (id) => setSelectToAdd(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const confirmAdd = async () => {
    const ids = selectToAdd.filter(id => !queue.includes(id));
    if (!ids.length) { closeAddDialog(); return; }
    setQueue(q => [...q, ...ids]);
    if (!fileId && ids.length) setFileId(ids[0]);
    closeAddDialog();
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImageData(ev.target.result);
      setImagePreview(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const buildPayload = (id) => {
    const payload = { fileId: Number(id), type: mode, options: { opacity: opacity / 100, rotate, position, mosaic } };
    if (mode === 'text') {
      payload.text = text;
      payload.options.fontSize = fontSize || 12; // Ensure valid fontSize
      payload.options.font = font;
      payload.options.bold = bold;
      payload.options.underline = underline;
      payload.options.hexColor = color;
    } else if (mode === 'image') {
      payload.imageData = imageData;
      payload.options.imageSize = imageSize / 100; // Convert percentage to decimal
    }
    return payload;
  };

  const applyOne = async (id) => {
    const payload = buildPayload(id);
    const { data } = await http.post('/api/watermark/apply', payload);
    return { id, url: data.url };
  };

  const generatePreview = async () => {
    if (!fileId) return;
    if (mode === 'image' && !imageData) return;
    setPreviewBusy(true);
    setPreviewSrc(null);
    try {
      const payload = buildPayload(fileId);
      const { data } = await http.post('/api/watermark/preview', payload);
      setPreviewSrc(data.preview);
    } catch (e) {
      // swallow
    } finally {
      setPreviewBusy(false);
    }
  };

  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  const submit = async () => {
    if (!queue.length) return;
    if (mode === 'image' && !imageData) return; // image settings required
    setProcessing(true);
    setProcessedCount(0);
    const results = [];
    for (const id of queue) {
      try {
        const { url } = await applyOne(id);
        results.push({ id, url });
      } catch (e) {
        results.push({ id, error: e.response?.data?.message || 'Error' });
      }
      setProcessedCount(c => c + 1);
    }
    setResultUrls(results);
    await reloadFiles();
    // broadcast update so dashboard refreshes
    try { localStorage.setItem('wm_update', Date.now().toString()); } catch { }
    // Clear queue after apply per requirement
    setQueue([]);
    try { localStorage.setItem('wm_queue', '[]'); } catch { }
    setProcessing(false);
  };

  // Batch apply removed; items applied automatically when added

  const urlFor = (id) => resultUrls.find((r) => r.id === id)?.url;

  return (
    <Container sx={{ mt: 2 }}>
      {/* Queue Section */}
      <Card sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle2">Queue</Typography>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAddDialog} disabled={busy}>Add</Button>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {queue.map((q) => {
            const f = files.find((x) => String(x.id) === q);
            return (
              <Chip
                key={q}
                label={f ? f.originalName : q}
                onDelete={() => removeFromQueue(q)}
                onClick={() => setFileId(q)}
                color={urlFor(q) ? 'success' : 'default'}
                variant={fileId === q ? 'filled' : 'outlined'}
              />
            );
          })}
          {!queue.length && <Typography variant="body2" color="text.secondary">Queue empty. Click Add.</Typography>}
        </Stack>
      </Card>

      <Grid container spacing={3}>
        {/* Settings */}
        <Grid item xs={12} md={5}>
          <Card sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Watermark Settings</Typography>
            <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 2 }}>
              <ToggleButton value="text">Text</ToggleButton>
              <ToggleButton value="image">Image</ToggleButton>
            </ToggleButtonGroup>
            {mode === 'text' && (
              <Box>
                <TextField label="Text" fullWidth size="small" value={text} onChange={(e) => setText(e.target.value)} sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField label="Font" select size="small" value={font} onChange={(e) => setFont(e.target.value)} sx={{ flex: 1 }}>
                    {['Helvetica', 'Times', 'Courier'].map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </TextField>
                  <TextField
                    label="Size"
                    size="small"
                    type="number"
                    value={fontSize}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setFontSize(''); // Allow empty state
                      } else {
                        const numValue = Number(value);
                        if (!isNaN(numValue) && numValue > 0) {
                          setFontSize(numValue);
                        }
                      }
                    }}
                    onBlur={() => {
                      // Set default value if empty when field loses focus
                      if (fontSize === '' || fontSize <= 0) {
                        setFontSize(12);
                      }
                    }}
                    sx={{ width: 90 }}
                    inputProps={{ min: 1, max: 200 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <ToggleButtonGroup size="small" exclusive sx={{ mr: 1 }}>
                    <ToggleButton value="bold" selected={bold} onChange={() => setBold(b => !b)} aria-label="Bold" title="Bold">
                      <FormatBoldIcon fontSize="small" />
                    </ToggleButton>
                    <ToggleButton value="underline" selected={underline} onChange={() => setUnderline(u => !u)} aria-label="Underline" title="Underline">
                      <FormatUnderlinedIcon fontSize="small" />
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Button variant="outlined" size="small" onClick={(e) => { setColorAnchor(e.currentTarget); setTimeout(() => { try { colorInputRef.current?.click(); } catch { } }, 0); }} sx={{ px: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 18, height: 18, borderRadius: '4px', bgcolor: color, border: '1px solid #ccc' }} />
                    <Typography variant="caption" sx={{ textTransform: 'none' }}>{color}</Typography>
                  </Button>
                  <Popover
                    open={Boolean(colorAnchor)}
                    anchorEl={colorAnchor}
                    onClose={() => setColorAnchor(null)}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                    PaperProps={{ sx: { p: 1.5 } }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, letterSpacing: .5 }}>Select color</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ position: 'relative', width: 48, height: 36 }}>
                          <input
                            ref={colorInputRef}
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            style={{ width: '48px', height: '36px', padding: 0, border: '1px solid #ccc', background: 'transparent', cursor: 'pointer', borderRadius: 4 }}
                          />
                        </Box>
                        <TextField
                          size="small"
                          label="Hex"
                          value={color}
                          onChange={(e) => {
                            let v = e.target.value.trim();
                            if (!v.startsWith('#')) v = '#' + v;
                            if (v === '#' || /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) setColor(v);
                          }}
                          sx={{ width: 140 }}
                          inputProps={{ maxLength: 7, style: { fontFamily: 'monospace' } }}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {presetColors.map(pc => (
                          <Box key={pc} onClick={() => setColor(pc)} title={pc}
                            sx={{ width: 22, height: 22, borderRadius: '4px', bgcolor: pc, border: pc.toLowerCase() === '#ffffff' ? '1px solid #ccc' : '1px solid rgba(0,0,0,0.15)', cursor: 'pointer', boxShadow: color === pc ? '0 0 0 2px #1976d2' : 'none', transition: 'box-shadow .15s' }} />
                        ))}
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">{color}</Typography>
                        <Button size="small" onClick={() => setColorAnchor(null)}>Close</Button>
                      </Box>
                    </Box>
                  </Popover>
                </Box>
              </Box>
            )}
            {mode === 'image' && (
              <Box sx={{ mb: 2 }}>
                <Button component="label" variant="outlined" size="small">
                  {imageData ? 'Change Image' : 'Add Image'}
                  <input hidden type="file" accept="image/*" onChange={handleImageSelect} />
                </Button>
                {imagePreview && (
                  <Box sx={{ mt: 1 }}>
                    <img src={imagePreview} alt="preview" style={{ maxWidth: '100%', maxHeight: 120, objectFit: 'contain', borderRadius: 4, border: '1px solid #eee' }} />
                  </Box>
                )}
                {imageData && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption">Size: {imageSize}%</Typography>
                    <Slider
                      size="small"
                      value={imageSize}
                      onChange={(_, v) => setImageSize(v)}
                      min={10}
                      max={200}
                      step={5}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(value) => `${value}%`}
                    />
                  </Box>
                )}
              </Box>
            )}
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Position:</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3,32px)', gridTemplateRows: 'repeat(3,32px)', gap: 0.5, width: 'fit-content', mb: 1 }}>
                {[
                  'top-left', 'top-center', 'top-right',
                  'middle-left', 'center', 'middle-right',
                  'bottom-left', 'bottom-center', 'bottom-right'
                ].map(p => (
                  <Box key={p} onClick={() => setPosition(p)} sx={{ width: 32, height: 32, border: '1px dashed #bbb', cursor: 'pointer', position: 'relative', bgcolor: position === p ? 'primary.light' : 'transparent', '&:hover': { bgcolor: position === p ? 'primary.light' : '#f5f5f5' } }}>
                    {position === p && <Box sx={{ width: 10, height: 10, bgcolor: 'error.main', borderRadius: '50%', position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />}
                  </Box>
                ))}
              </Box>
              <FormControlLabel control={<Checkbox size="small" checked={mosaic} onChange={(e) => setMosaic(e.target.checked)} />} label="Mosaic" />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption">Opacity: {opacity}%</Typography>
              <Slider size="small" value={opacity} onChange={(_, v) => setOpacity(v)} min={5} max={90} />
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption">Rotation: {rotate}°</Typography>
              <Slider size="small" value={rotate} onChange={(_, v) => setRotate(v)} min={-180} max={180} />
            </Box>
            <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
              <Button
                disabled={!fileId || previewBusy || (mode === 'image' && !imageData)}
                onClick={generatePreview}
                variant="outlined"
                sx={{ flex: 1 }}
              >
                Apply Setting & Preview
              </Button>
              <Button
                onClick={resetToDefaults}
                variant="text"
                size="small"
                sx={{
                  minWidth: 'auto',
                  px: 2,
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'action.hover',
                    color: 'text.primary'
                  }
                }}
              >
                Reset
              </Button>
            </Box>
          </Card>
        </Grid>
        {/* Preview */}
        <Grid item xs={12} md={7} sx={{ display: 'flex', flexDirection: 'column' }}>
          <Card sx={{ p: 2, height: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1 }}>
              <Typography variant="subtitle2">Preview</Typography>
              {queue.length > 0 && (
                <TextField
                  select
                  size="small"
                  label="File"
                  value={fileId || ''}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setFileId(newId);
                    setPreviewSrc(null);
                    // Auto-generate preview for the new file
                    if (newId && (mode !== 'image' || imageData)) {
                      setTimeout(() => generatePreview(), 100);
                    }
                  }}
                  sx={{ minWidth: 160 }}
                >
                  {queue.map(id => {
                    const f = files.find(x => String(x.id) === id);
                    return <MenuItem key={id} value={id}>{f ? f.originalName : id}</MenuItem>;
                  })}
                </TextField>
              )}
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, bgcolor: '#fafafa', border: '1px dashed #ddd', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 1, overflow: 'hidden' }}>
              {!selected && <Typography variant="body2" color="text.secondary">Select a file and adjust settings.</Typography>}
              {selected && !previewSrc && !previewBusy && (
                <Typography variant="body2" color="text.secondary">Click "Apply Setting" to preview.</Typography>
              )}
              {previewBusy && <Typography variant="body2" color="text.secondary">Generating preview...</Typography>}
              {previewSrc && (
                <iframe title="preview" src={previewSrc} style={{ border: 'none', width: '100%', height: '100%' }} />
              )}
            </Box>
            {/* Result links removed per new workflow */}
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button disabled={!queue.length || processing || (mode === 'image' && !imageData)} onClick={submit} variant="contained">Apply Watermark</Button>
            </Box>
          </Card>
        </Grid>
      </Grid>
      <Dialog open={addOpen} onClose={closeAddDialog} fullWidth maxWidth="sm">
        <DialogTitle>Select uploaded files</DialogTitle>
        <DialogContent dividers>
          <List dense>
            {files.filter(f => !queue.includes(String(f.id)) && !f.watermarkApplied).map(f => (
              <ListItem key={f.id} button onClick={() => toggleSelect(String(f.id))} disabled={busy}>
                <ListItemIcon>
                  <Checkbox edge="start" size="small" checked={selectToAdd.includes(String(f.id))} tabIndex={-1} disableRipple />
                </ListItemIcon>
                <ListItemText primary={f.originalName} secondary={`${(f.size / 1024).toFixed(1)} KB`} />
              </ListItem>
            ))}
            {!files.filter(f => !queue.includes(String(f.id)) && !f.watermarkApplied).length && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  No files without watermark available.
                </Typography>
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => {
                    setAddOpen(false);
                    navigate('/');
                  }}
                  sx={{
                    textDecoration: 'underline',
                    color: 'primary.main',
                    '&:hover': { color: 'primary.dark' }
                  }}
                >
                  Upload files
                </Link>
              </Box>
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeAddDialog} disabled={busy}>Cancel</Button>
          <Button onClick={confirmAdd} disabled={!selectToAdd.length || busy} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
      <Backdrop open={processing} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 10, flexDirection: 'column', gap: 2 }}>
        <CircularProgress color="inherit" />
        <Typography variant="body2">[{processedCount}] file{processedCount === 1 ? '' : 's'} have been add watermark.</Typography>
      </Backdrop>
    </Container>
  );
}
