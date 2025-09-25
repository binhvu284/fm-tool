import React, { useEffect, useState, useCallback } from 'react';
import { 
  Container, Typography, Button, Card, Box, Chip, Dialog, DialogTitle, 
  DialogContent, DialogActions, FormControl, FormLabel, RadioGroup, 
  FormControlLabel, Radio, TextField, Select, MenuItem, Slider,
  ToggleButton, ToggleButtonGroup, Divider, IconButton, Tooltip,
  Alert, AlertTitle, Grid, Paper
} from '@mui/material';
import { 
  Add as AddIcon, Delete as DeleteIcon, DragIndicator as DragIcon,
  FormatBold as BoldIcon, FormatItalic as ItalicIcon, 
  FormatUnderlined as UnderlineIcon, Security as SecurityIcon,
  Create as CreateIcon, Verified as VerifiedIcon, Info as InfoIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import http from '../../api/http.js';

export default function SignaturePage() {
  // Queue state
  const [queue, setQueue] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  
  // Signature settings
  const [signatureType, setSignatureType] = useState('simple');
  const [signatureFields, setSignatureFields] = useState([]);
  const [nextFieldId, setNextFieldId] = useState(1);
  
  // Preview state
  const [previewSrc, setPreviewSrc] = useState(null);
  
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

  // Load files on component mount
  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      const { data } = await http.get('/api/files');
      setQueue(data.filter(file => !file.hasSignature));
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  };

  // File upload with drag & drop
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      await http.post('/api/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchFiles();
    } catch (error) {
      console.error('Upload failed:', error);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  // Queue management
  const removeFromQueue = (fileId) => {
    setQueue(queue.filter(f => f.id !== fileId));
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
      setPreviewSrc(null);
    }
  };

  const selectFile = async (file) => {
    setSelectedFile(file);
    try {
      const response = await http.get(`/api/files/${file.id}/preview`);
      setPreviewSrc(response.data.previewUrl);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  };

  // Signature field management
  const addSignatureField = () => {
    const field = {
      id: nextFieldId,
      ...fieldSettings,
      x: 50,
      y: 50,
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
          color: field.color
        }))
      };

      const { data } = await http.post('/api/signature/sign', payload);
      setResultUrls(prev => [...prev, data.url]);
      
      // Remove from queue after successful signing
      removeFromQueue(selectedFile.id);
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
          <Button startIcon={<AddIcon />} variant="contained" size="small">
            ADD
          </Button>
        </Box>
        
        {/* File Upload Area */}
        <Card 
          sx={{ 
            border: '1px dashed #c5cae9', 
            background: isDragActive ? '#eef2ff' : '#fafbff',
            mb: 2 
          }} 
          {...getRootProps()}
        >
          <input {...getInputProps()} />
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <SecurityIcon sx={{ fontSize: 48, color: '#5c6ac4', mb: 1 }} />
            <Typography variant="body1" sx={{ mb: 1 }}>Drag & drop PDFs</Typography>
            <Typography variant="caption" color="text.secondary">or click to select</Typography>
          </Box>
        </Card>

        {/* Queue Items */}
        {queue.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            Queue empty. Click ADD to upload files or drag files here.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {queue.map((file) => (
              <Chip
                key={file.id}
                label={file.originalName}
                onClick={() => selectFile(file)}
                onDelete={() => removeFromQueue(file.id)}
                color={selectedFile?.id === file.id ? 'primary' : 'default'}
                variant={selectedFile?.id === file.id ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        )}
      </Card>

      <Grid container spacing={3}>
        {/* Signature Settings */}
        <Grid item xs={12} md={4}>
          <Card sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Signature Settings</Typography>
            
            {/* Signature Type */}
            <FormControl component="fieldset" sx={{ mb: 3 }}>
              <FormLabel component="legend">Signature Type</FormLabel>
              <RadioGroup 
                value={signatureType} 
                onChange={(e) => setSignatureType(e.target.value)}
                sx={{ mt: 1 }}
              >
                <FormControlLabel 
                  value="simple" 
                  control={<Radio />} 
                  label={
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CreateIcon fontSize="small" />
                        <Typography variant="body2" fontWeight={500}>Simple Signature</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Image-based signature for internal use. No legal value.
                      </Typography>
                    </Box>
                  } 
                />
                <FormControlLabel 
                  value="digital" 
                  control={<Radio />} 
                  label={
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <VerifiedIcon fontSize="small" />
                        <Typography variant="body2" fontWeight={500}>Digital Signature</Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        Certificate-based signature. eIDAS, ESIGN & UETA compliant.
                      </Typography>
                    </Box>
                  } 
                />
              </RadioGroup>
            </FormControl>

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
          <Card sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Preview</Typography>
              {selectedFile && (
                <Typography variant="caption" color="text.secondary">
                  File: {selectedFile.originalName}
                </Typography>
              )}
            </Box>

            {!selectedFile ? (
              <Box sx={{ 
                height: 400, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                border: '2px dashed #ddd'
              }}>
                <Box sx={{ textAlign: 'center' }}>
                  <InfoIcon sx={{ fontSize: 48, color: '#999', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Select a file from the queue to preview
                  </Typography>
                </Box>
              </Box>
            ) : (
              <Box sx={{ 
                position: 'relative',
                height: 400,
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                overflow: 'hidden'
              }}>
                {/* PDF Preview would go here */}
                <Box sx={{ 
                  width: '100%', 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: '#666'
                }}>
                  <Typography>PDF Preview: {selectedFile.originalName}</Typography>
                </Box>

                {/* Signature Field Overlays */}
                {signatureFields.map((field) => (
                  <Box
                    key={field.id}
                    sx={{
                      position: 'absolute',
                      left: field.x,
                      top: field.y,
                      width: field.width,
                      height: field.height,
                      border: '2px solid #1976d2',
                      borderRadius: 1,
                      bgcolor: 'rgba(25, 118, 210, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'move',
                      fontSize: field.fontSize,
                      fontFamily: field.fontFamily,
                      fontWeight: field.bold ? 'bold' : 'normal',
                      fontStyle: field.italic ? 'italic' : 'normal',
                      textDecoration: field.underline ? 'underline' : 'none',
                      color: field.color
                    }}
                    onClick={() => {
                      setEditingField(field);
                      setFieldSettings(field);
                      setAddFieldDialogOpen(true);
                    }}
                  >
                    <Typography variant="caption">
                      {field.text}
                    </Typography>
                    <IconButton
                      size="small"
                      sx={{ 
                        position: 'absolute', 
                        top: -8, 
                        right: -8, 
                        bgcolor: 'white',
                        '&:hover': { bgcolor: 'white' }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSignatureField(field.id);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>

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
        <DialogTitle>
          {editingField ? 'Edit Signature Field' : 'Add Signature Field'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Signature Text"
            value={fieldSettings.text}
            onChange={(e) => setFieldSettings({ ...fieldSettings, text: e.target.value })}
            sx={{ mb: 2 }}
          />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <Typography variant="caption">Font Family</Typography>
                <Select
                  value={fieldSettings.fontFamily}
                  onChange={(e) => setFieldSettings({ ...fieldSettings, fontFamily: e.target.value })}
                  size="small"
                >
                  <MenuItem value="Helvetica">Helvetica</MenuItem>
                  <MenuItem value="Times-Roman">Times Roman</MenuItem>
                  <MenuItem value="Courier">Courier</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption">Font Size</Typography>
              <Slider
                value={fieldSettings.fontSize}
                onChange={(_, value) => setFieldSettings({ ...fieldSettings, fontSize: value })}
                min={8}
                max={24}
                step={1}
                valueLabelDisplay="auto"
                size="small"
              />
            </Grid>
          </Grid>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption">Style</Typography>
            <ToggleButtonGroup size="small" sx={{ display: 'flex', mt: 1 }}>
              <ToggleButton
                value="bold"
                selected={fieldSettings.bold}
                onChange={() => setFieldSettings({ ...fieldSettings, bold: !fieldSettings.bold })}
              >
                <BoldIcon />
              </ToggleButton>
              <ToggleButton
                value="italic"
                selected={fieldSettings.italic}
                onChange={() => setFieldSettings({ ...fieldSettings, italic: !fieldSettings.italic })}
              >
                <ItalicIcon />
              </ToggleButton>
              <ToggleButton
                value="underline"
                selected={fieldSettings.underline}
                onChange={() => setFieldSettings({ ...fieldSettings, underline: !fieldSettings.underline })}
              >
                <UnderlineIcon />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="caption">Width</Typography>
              <Slider
                value={fieldSettings.width}
                onChange={(_, value) => setFieldSettings({ ...fieldSettings, width: value })}
                min={100}
                max={400}
                step={10}
                valueLabelDisplay="auto"
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <Typography variant="caption">Height</Typography>
              <Slider
                value={fieldSettings.height}
                onChange={(_, value) => setFieldSettings({ ...fieldSettings, height: value })}
                min={30}
                max={150}
                step={5}
                valueLabelDisplay="auto"
                size="small"
              />
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
    </Container>
  );
}
