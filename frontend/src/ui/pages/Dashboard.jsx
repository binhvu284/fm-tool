import React, { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  LinearProgress,
  Menu,
  MenuItem,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  ListItemIcon,
  TextField,
  TableSortLabel,
  Checkbox,
  Tooltip,
  Button,
  Popover,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Tabs,
  Tab
} from '@mui/material';
import { useDropzone } from 'react-dropzone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DoneIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Cancel';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FilterListIcon from '@mui/icons-material/FilterList';
import http from '../../api/http.js';

function StatusIcon({ ok }) {
  return ok ? <DoneIcon color="success" fontSize="small" /> : <CloseIcon color="disabled" fontSize="small" />;
}

export default function Dashboard() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuFile, setMenuFile] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [wmFilter, setWmFilter] = useState('all');
  const [sigFilter, setSigFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('all');
  const [orderBy, setOrderBy] = useState('id');
  const [order, setOrder] = useState('desc');
  const [selected, setSelected] = useState([]); // selected file ids
  const [errorMsg, setErrorMsg] = useState('');
  const [backendDown, setBackendDown] = useState(false);

  // Time filter dropdown states
  const [timeFilterAnchor, setTimeFilterAnchor] = useState(null);
  const [timeFilterTab, setTimeFilterTab] = useState(0); // 0: relative, 1: custom, 2: range
  const [customTimeValue, setCustomTimeValue] = useState('');
  const [customTimeUnit, setCustomTimeUnit] = useState('day');
  const [dateRangeFrom, setDateRangeFrom] = useState('');
  const [dateRangeTo, setDateRangeTo] = useState('');
  const [timeRangeFromHour, setTimeRangeFromHour] = useState('');
  const [timeRangeToHour, setTimeRangeToHour] = useState('');

  const fetchFiles = async (retryCount = 0) => {
    try {
      const { data } = await http.get('/api/files');
      setFiles(data);
      setBackendDown(false);
    } catch (e) {
      console.warn('Failed to fetch files:', e.message);
      setBackendDown(true);

      // Auto-retry on initial load (up to 3 times with increasing delay)
      if (retryCount < 3 && (e.code === 'ECONNREFUSED' || e.code === 'ERR_NETWORK')) {
        const delay = (retryCount + 1) * 2000; // 2s, 4s, 6s delays
        console.log(`Retrying in ${delay / 1000}s...`);
        setTimeout(() => fetchFiles(retryCount + 1), delay);
      }
    }
  };

  useEffect(() => {
    fetchFiles();
    const handler = (e) => { if (e.key === 'wm_update') fetchFiles(); };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return;
    setUploading(true);
    setProgress(10);
    setErrorMsg('');
    const form = new FormData();
    acceptedFiles.forEach((f) => form.append('files', f));
    try {
      await http.post('/api/files/upload', form, { onUploadProgress: (e) => { if (e.total) setProgress(Math.round((e.loaded / e.total) * 100)); } });
      setProgress(100);
      await fetchFiles();
    } catch (e) {
      setErrorMsg(e?.response?.data?.message || 'Upload failed. Please try again later.');
    } finally {
      setUploading(false);
      setTimeout(() => setProgress(0), 1200);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/pdf': ['.pdf'] } });

  const openMenu = (e, file) => { setAnchorEl(e.currentTarget); setMenuFile(file); };
  const closeMenu = () => { setAnchorEl(null); setMenuFile(null); };

  const apiBase = import.meta.env.VITE_API_BASE || '';

  const handleOpen = () => {
    if (!menuFile) return;
    const url = `${apiBase}/static/${menuFile.storedName}`;
    window.open(url, '_blank');
    closeMenu();
  };
  const handleDownload = async () => {
    if (!menuFile) return;
    try {
      const res = await fetch(`/api/files/${menuFile.id}/download`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = menuFile.originalName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { }
    closeMenu();
  };
  const handleDelete = async () => {
    if (!menuFile) return;
    const id = menuFile.id;
    // Optimistic remove
    setFiles(prev => prev.filter(f => f.id !== id));
    setSelected(sel => sel.filter(x => x !== id));
    closeMenu();
    try {
      await http.delete(`/api/files/${id}`);
      // Remove from persisted watermark queue and notify listeners
      try {
        const q = JSON.parse(localStorage.getItem('wm_queue') || '[]');
        const newQ = q.filter(x => String(x) !== String(id));
        localStorage.setItem('wm_queue', JSON.stringify(newQ));
      } catch { }
      window.dispatchEvent(new CustomEvent('wm-files-deleted', { detail: { ids: [String(id)] } }));
    } catch (e) {
      // If failed, refetch to restore
      fetchFiles();
    }
  };

  const toggleSelectAll = (e) => {
    const ids = sorted.map(f => f.id);
    if (e.target.checked) setSelected(ids); else setSelected([]);
  };
  const toggleOne = (id) => {
    setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  };
  const bulkDelete = async () => {
    if (!selected.length) return;
    const ids = selected;
    // Optimistic remove
    setFiles(prev => prev.filter(f => !ids.includes(f.id)));
    setSelected([]);
    try {
      await http.post('/api/files/bulk/delete', { ids });
      try {
        const q = JSON.parse(localStorage.getItem('wm_queue') || '[]');
        const newQ = q.filter(x => !ids.map(String).includes(String(x)));
        localStorage.setItem('wm_queue', JSON.stringify(newQ));
      } catch { }
      window.dispatchEvent(new CustomEvent('wm-files-deleted', { detail: { ids: ids.map(String) } }));
    } catch {
      fetchFiles();
    }
  };
  const bulkDownload = async () => {
    if (!selected.length) return;
    try {
      const res = await fetch('/api/files/bulk/download', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` }, body: JSON.stringify({ ids: selected }) });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'files.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { }
  };

  // Time range filter helper
  const getTimeRangeFilter = (range) => {
    const now = new Date();
    switch (range) {
      case 'hour':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
      case 'day':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'custom':
        if (!customTimeValue) return null;
        const value = parseInt(customTimeValue);
        if (isNaN(value)) return null;
        const multipliers = {
          hour: 60 * 60 * 1000,
          day: 24 * 60 * 60 * 1000,
          week: 7 * 24 * 60 * 60 * 1000,
          month: 30 * 24 * 60 * 60 * 1000,
          year: 365 * 24 * 60 * 60 * 1000
        };
        return new Date(now.getTime() - value * (multipliers[customTimeUnit] || multipliers.day));
      default:
        return null;
    }
  };

  const isTimeFilterActive = () => {
    return timeRange !== 'all' ||
      (timeFilterTab === 1 && customTimeValue) ||
      (timeFilterTab === 2 && (dateRangeFrom || dateRangeTo));
  };

  const getTimeFilterDescription = () => {
    if (timeRange === 'hour') return 'Last hour';
    if (timeRange === 'today') return 'Today';
    if (timeRange === 'day') return 'Last 24h';
    if (timeRange === 'week') return 'Last week';
    if (timeRange === 'month') return 'Last month';
    if (timeRange === 'custom' && customTimeValue) {
      const unit = customTimeValue > 1 ? `${customTimeUnit}s` : customTimeUnit;
      return `Last ${customTimeValue} ${unit}`;
    }
    if (timeRange === 'range') {
      if (dateRangeFrom && dateRangeTo) {
        const fromDate = new Date(dateRangeFrom).toLocaleDateString();
        const toDate = new Date(dateRangeTo).toLocaleDateString();
        return `${fromDate} - ${toDate}`;
      } else if (dateRangeFrom) {
        const fromDate = new Date(dateRangeFrom).toLocaleDateString();
        return `From ${fromDate}`;
      } else if (dateRangeTo) {
        const toDate = new Date(dateRangeTo).toLocaleDateString();
        return `Until ${toDate}`;
      }
    }
    return null;
  };

  const clearTimeFilter = () => {
    setTimeRange('all');
    setCustomTimeValue('');
    setCustomTimeUnit('day');
    setDateRangeFrom('');
    setDateRangeTo('');
    setTimeRangeFromHour('');
    setTimeRangeToHour('');
    setTimeFilterTab(0);
  };

  const applyTimeFilter = () => {
    if (timeFilterTab === 1 && customTimeValue) {
      setTimeRange('custom');
    } else if (timeFilterTab === 2 && (dateRangeFrom || dateRangeTo)) {
      setTimeRange('range');
    }
    setTimeFilterAnchor(null);
  };

  // Derived rows: filter -> search -> sort
  const filtered = files.filter(f => {
    if (search && !f.originalName.toLowerCase().includes(search.toLowerCase()) && String(f.id) !== search) return false;
    if (statusFilter !== 'all') {
      const status = f.status === 'approved' ? 'approved' : 'pending';
      if (status !== statusFilter) return false;
    }
    if (wmFilter !== 'all') {
      if (wmFilter === 'yes' && !f.watermarkApplied) return false;
      if (wmFilter === 'no' && f.watermarkApplied) return false;
    }
    if (sigFilter !== 'all') {
      if (sigFilter === 'yes' && !f.signatureApplied) return false;
      if (sigFilter === 'no' && f.signatureApplied) return false;
    }
    // Time range filter
    if (timeRange !== 'all') {
      const fileDate = f.createdAt ? new Date(f.createdAt) : null;
      if (!fileDate) return false;

      if (timeRange === 'range') {
        // Date range filtering with optional time
        if (dateRangeFrom) {
          const fromDate = new Date(dateRangeFrom);
          if (timeRangeFromHour) {
            const [hours, minutes] = timeRangeFromHour.split(':');
            fromDate.setHours(parseInt(hours), parseInt(minutes || 0));
          } else {
            fromDate.setHours(0, 0, 0, 0);
          }
          if (fileDate < fromDate) return false;
        }
        if (dateRangeTo) {
          const toDate = new Date(dateRangeTo);
          if (timeRangeToHour) {
            const [hours, minutes] = timeRangeToHour.split(':');
            toDate.setHours(parseInt(hours), parseInt(minutes || 0));
          } else {
            toDate.setHours(23, 59, 59, 999);
          }
          if (fileDate > toDate) return false;
        }
      } else {
        // Relative time filtering
        const cutoffDate = getTimeRangeFilter(timeRange);
        if (cutoffDate && fileDate < cutoffDate) return false;
      }
    }
    return true;
  });

  const compare = (a, b, key) => {
    let va, vb;
    switch (key) {
      case 'name': va = a.originalName.toLowerCase(); vb = b.originalName.toLowerCase(); break;
      case 'uploaded': va = new Date(a.createdAt || 0).getTime(); vb = new Date(b.createdAt || 0).getTime(); break;
      case 'status': va = (a.status === 'approved') ? 1 : 0; vb = (b.status === 'approved') ? 1 : 0; break;
      case 'watermark': va = a.watermarkApplied ? 1 : 0; vb = b.watermarkApplied ? 1 : 0; break;
      case 'signature': va = a.signatureApplied ? 1 : 0; vb = b.signatureApplied ? 1 : 0; break;
      case 'id': default: va = a.id; vb = b.id; break;
    }
    if (va < vb) return -1; if (va > vb) return 1; return 0;
  };
  const sorted = [...filtered].sort((a, b) => {
    const c = compare(a, b, orderBy);
    return order === 'asc' ? c : -c;
  });

  const allVisibleIds = sorted.map(f => f.id);

  const handleSort = (col) => {
    if (orderBy === col) {
      setOrder(o => o === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(col);
      setOrder('asc');
    }
  };

  return (
    <Container sx={{ mt: 2 }}>
      <Card sx={{ border: '1px dashed #c5cae9', background: isDragActive ? '#eef2ff' : '#fafbff' }} {...getRootProps()}>
        <CardContent sx={{ textAlign: 'center', py: 5 }}>
          <input {...getInputProps()} />
          <CloudUploadIcon color="primary" sx={{ fontSize: 40 }} />
          <Typography variant="h6">Drag & drop PDFs</Typography>
          <Typography variant="body2" color="text.secondary">or click to select</Typography>
          {uploading && <Box sx={{ mt: 2 }}><LinearProgress variant="determinate" value={progress} /></Box>}
          {!uploading && errorMsg && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}>{errorMsg}</Typography>
          )}
          {!uploading && backendDown && !errorMsg && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 1 }}> Sorry, this function is not working, please try again later.</Typography>
          )}
        </CardContent>
      </Card>

      <Box sx={{ mt: 3 }}>
        {/* Modern SaaS-style single-row filter bar */}
        <Box sx={{
          display: 'flex',
          gap: 1.5,
          mb: 2,
          p: 1.5,
          bgcolor: '#fafafa',
          borderRadius: 2,
          border: '1px solid #e0e0e0',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <TextField
            size="small"
            label="Search"
            placeholder="Search files..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            sx={{ minWidth: 180, flex: 1 }}
            variant="outlined"
          />
          <TextField
            size="small"
            label="Status"
            select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            sx={{ minWidth: 110 }}
            variant="outlined"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="approved">Approved</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Watermark"
            select
            value={wmFilter}
            onChange={e => setWmFilter(e.target.value)}
            sx={{ minWidth: 120 }}
            variant="outlined"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="yes">Applied</MenuItem>
            <MenuItem value="no">Not Applied</MenuItem>
          </TextField>
          <TextField
            size="small"
            label="Signature"
            select
            value={sigFilter}
            onChange={e => setSigFilter(e.target.value)}
            sx={{ minWidth: 120 }}
            variant="outlined"
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="yes">Applied</MenuItem>
            <MenuItem value="no">Not Applied</MenuItem>
          </TextField>

          {/* Time Filter Icon with Description */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Uploaded Time Filter">
              <IconButton
                size="small"
                onClick={e => setTimeFilterAnchor(e.currentTarget)}
                sx={{
                  border: '1px solid #d0d7de',
                  borderRadius: 1,
                  bgcolor: isTimeFilterActive() ? '#e3f2fd' : 'transparent',
                  color: isTimeFilterActive() ? '#1976d2' : '#656d76',
                  '&:hover': { bgcolor: isTimeFilterActive() ? '#bbdefb' : '#f5f5f5' }
                }}
              >
                <AccessTimeIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            {/* Filter Description */}
            {isTimeFilterActive() && getTimeFilterDescription() && (
              <Typography
                variant="caption"
                sx={{
                  color: '#1976d2',
                  fontWeight: 500,
                  px: 1,
                  py: 0.5,
                  bgcolor: '#e3f2fd',
                  borderRadius: 1,
                  border: '1px solid #bbdefb',
                  whiteSpace: 'nowrap'
                }}
              >
                {getTimeFilterDescription()}
              </Typography>
            )}
          </Box>

          {(search || statusFilter !== 'all' || wmFilter !== 'all' || sigFilter !== 'all' || isTimeFilterActive()) && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setWmFilter('all');
                setSigFilter('all');
                clearTimeFilter();
              }}
              sx={{
                textTransform: 'none',
                borderColor: '#d0d7de',
                color: '#656d76',
                '&:hover': { borderColor: '#8c959f', bgcolor: 'rgba(175, 184, 193, 0.2)' }
              }}
            >
              Clear Filters
            </Button>
          )}
        </Box>

        {/* Time Filter Popover */}
        <Popover
          open={Boolean(timeFilterAnchor)}
          anchorEl={timeFilterAnchor}
          onClose={() => setTimeFilterAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          PaperProps={{ sx: { minWidth: 320 } }}
        >
          {/* Filter Label */}
          <Box sx={{ p: 2, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Filter by Upload Time
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Show files uploaded within the selected time range
            </Typography>
          </Box>

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
              value={timeFilterTab}
              onChange={(e, newValue) => setTimeFilterTab(newValue)}
              variant="fullWidth"
              sx={{ minHeight: 40 }}
            >
              <Tab
                label="Relative"
                sx={{
                  minHeight: 40,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  fontWeight: timeFilterTab === 0 ? 600 : 400
                }}
              />
              <Tab
                label="Custom"
                sx={{
                  minHeight: 40,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  fontWeight: timeFilterTab === 1 ? 600 : 400
                }}
              />
              <Tab
                label="Date Range"
                sx={{
                  minHeight: 40,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  fontWeight: timeFilterTab === 2 ? 600 : 400
                }}
              />
            </Tabs>
          </Box>

          <Box sx={{ p: 2 }}>
            {/* Relative Time Tab */}
            {timeFilterTab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button
                  size="small"
                  variant={timeRange === 'hour' ? 'contained' : 'outlined'}
                  onClick={() => setTimeRange('hour')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Last Hour
                </Button>
                <Button
                  size="small"
                  variant={timeRange === 'today' ? 'contained' : 'outlined'}
                  onClick={() => setTimeRange('today')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Today
                </Button>
                <Button
                  size="small"
                  variant={timeRange === 'day' ? 'contained' : 'outlined'}
                  onClick={() => setTimeRange('day')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Last 24h
                </Button>
                <Button
                  size="small"
                  variant={timeRange === 'week' ? 'contained' : 'outlined'}
                  onClick={() => setTimeRange('week')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Last Week
                </Button>
                <Button
                  size="small"
                  variant={timeRange === 'month' ? 'contained' : 'outlined'}
                  onClick={() => setTimeRange('month')}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  Last Month
                </Button>
              </Box>
            )}

            {/* Custom Duration Tab */}
            {timeFilterTab === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TextField
                    size="small"
                    label="Number"
                    type="number"
                    value={customTimeValue}
                    onChange={e => setCustomTimeValue(e.target.value)}
                    sx={{ width: 100 }}
                    inputProps={{ min: 1 }}
                  />
                  <TextField
                    size="small"
                    label="Unit"
                    select
                    value={customTimeUnit}
                    onChange={e => setCustomTimeUnit(e.target.value)}
                    sx={{ width: 120 }}
                  >
                    <MenuItem value="hour">Hour(s)</MenuItem>
                    <MenuItem value="day">Day(s)</MenuItem>
                    <MenuItem value="week">Week(s)</MenuItem>
                    <MenuItem value="month">Month(s)</MenuItem>
                    <MenuItem value="year">Year(s)</MenuItem>
                  </TextField>
                  <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                    ago
                  </Typography>
                </Box>
                {customTimeValue && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', px: 1 }}>
                    Show files uploaded in the last {customTimeValue} {customTimeUnit}{customTimeValue > 1 ? 's' : ''}
                  </Typography>
                )}
              </Box>
            )}

            {/* Date Range Tab */}
            {timeFilterTab === 2 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    label="From Date"
                    type="date"
                    value={dateRangeFrom}
                    onChange={e => setDateRangeFrom(e.target.value)}
                    sx={{ flex: 1 }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    size="small"
                    label="From Time"
                    type="time"
                    value={timeRangeFromHour}
                    onChange={e => setTimeRangeFromHour(e.target.value)}
                    sx={{ width: 110 }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small"
                    label="To Date"
                    type="date"
                    value={dateRangeTo}
                    onChange={e => setDateRangeTo(e.target.value)}
                    sx={{ flex: 1 }}
                    InputLabelProps={{ shrink: true }}
                  />
                  <TextField
                    size="small"
                    label="To Time"
                    type="time"
                    value={timeRangeToHour}
                    onChange={e => setTimeRangeToHour(e.target.value)}
                    sx={{ width: 110 }}
                    InputLabelProps={{ shrink: true }}
                  />
                </Box>
              </Box>
            )}
          </Box>

          <Divider />

          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', p: 2 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={clearTimeFilter}
              sx={{ textTransform: 'none' }}
            >
              Clear All
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={applyTimeFilter}
              sx={{ textTransform: 'none' }}
            >
              Apply Filter
            </Button>
          </Box>
        </Popover>
        {selected.length > 0 && (
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.75, borderRadius: 1, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f1f5f9', border: '1px solid', borderColor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : '#dbe2ea' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>{selected.length} selected</Typography>
            <Tooltip title="Download selected as ZIP"><span><Button size="small" variant="contained" onClick={bulkDownload} disabled={!selected.length}>Download ZIP</Button></span></Tooltip>
            <Tooltip title="Delete selected"><span><Button size="small" variant="outlined" color="error" onClick={bulkDelete} disabled={!selected.length}>Delete</Button></span></Tooltip>
            <Button size="small" onClick={() => setSelected([])} sx={{ textTransform: 'none', ml: 0.5 }}>Clear</Button>
          </Box>
        )}
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    size="small"
                    indeterminate={selected.length > 0 && selected.length < allVisibleIds.length}
                    checked={allVisibleIds.length > 0 && selected.length === allVisibleIds.length}
                    onChange={toggleSelectAll}
                  />
                </TableCell>
                <TableCell sortDirection={orderBy === 'id' ? order : false}>
                  <TableSortLabel active={orderBy === 'id'} direction={orderBy === 'id' ? order : 'asc'} onClick={() => handleSort('id')}>ID</TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'name' ? order : false}>
                  <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'asc'} onClick={() => handleSort('name')}>Name</TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'uploaded' ? order : false}>
                  <TableSortLabel active={orderBy === 'uploaded'} direction={orderBy === 'uploaded' ? order : 'asc'} onClick={() => handleSort('uploaded')}>Uploaded</TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'status' ? order : false}>
                  <TableSortLabel active={orderBy === 'status'} direction={orderBy === 'status' ? order : 'asc'} onClick={() => handleSort('status')}>Status</TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'watermark' ? order : false}>
                  <TableSortLabel active={orderBy === 'watermark'} direction={orderBy === 'watermark' ? order : 'asc'} onClick={() => handleSort('watermark')}>Watermark</TableSortLabel>
                </TableCell>
                <TableCell sortDirection={orderBy === 'signature' ? order : false}>
                  <TableSortLabel active={orderBy === 'signature'} direction={orderBy === 'signature' ? order : 'asc'} onClick={() => handleSort('signature')}>Signature</TableSortLabel>
                </TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((f) => {
                const status = f.status === 'approved' ? 'approved' : 'pending';
                const dt = f.createdAt ? new Date(f.createdAt) : null;
                const dateStr = dt ? dt.toLocaleDateString() : '-';
                const timeStr = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                return (
                  <TableRow key={f.id} hover selected={selected.includes(f.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.includes(f.id)} onChange={() => toggleOne(f.id)} />
                    </TableCell>
                    <TableCell>{f.id}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{f.originalName}</Typography>
                      <Typography variant="caption" color="text.secondary">{(f.size / 1024).toFixed(1)} KB</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" sx={{ display: 'block' }}>{dateStr}</Typography>
                      <Typography variant="caption" color="text.secondary">{timeStr}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={status} color={status === 'approved' ? 'success' : 'default'} />
                    </TableCell>
                    <TableCell><StatusIcon ok={f.watermarkApplied} /></TableCell>
                    <TableCell><StatusIcon ok={f.signatureApplied} /></TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => openMenu(e, f)}><MoreVertIcon /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!files.length && (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>No files yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        <MenuItem onClick={handleOpen}>
          <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
          Open
        </MenuItem>
        <MenuItem onClick={handleDownload}>
          <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
          Download
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" /></ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </Container>
  );
}
