import React, { useEffect, useState } from 'react';
import { Container, Typography, TextField, Button, Card, MenuItem, Box } from '@mui/material';
import http from '../../api/http.js';

export default function SignaturePage() {
  const [files, setFiles] = useState([]);
  const [fileId, setFileId] = useState('');
  const [resultUrl, setResultUrl] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await http.get('/api/files');
        setFiles(data);
      } catch {}
    })();
  }, []);

  const submit = async () => {
    const { data } = await http.post('/api/signature/sign', { fileId: Number(fileId) });
    setResultUrl(data.url);
  };

  return (
    <Container sx={{ mt: 2 }}>
      <Card sx={{ p: 2 }}>
        <TextField select label="Select file" value={fileId} onChange={(e) => setFileId(e.target.value)} fullWidth>
          {files.map((f) => (
            <MenuItem key={f.id} value={String(f.id)}>{f.originalName}</MenuItem>
          ))}
        </TextField>
        <Button onClick={submit} variant="contained" sx={{ mt: 2 }} disabled={!fileId}>Sign</Button>
        {resultUrl && (
          <Box sx={{ mt: 2 }}>
            <Button href={resultUrl} target="_blank" variant="outlined">Open signed PDF</Button>
          </Box>
        )}
      </Card>
    </Container>
  );
}
