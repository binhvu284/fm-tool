import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, List, ListItemButton, ListItemText, ListItemIcon, Paper, IconButton, Divider, Tooltip, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Checkbox, Menu, MenuItem, ListItemIcon as MListItemIcon, TextField, Button } from '@mui/material';
import FolderIcon from '@mui/icons-material/FolderOpen';
import PeopleIcon from '@mui/icons-material/PeopleAlt';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import UndoIcon from '@mui/icons-material/Undo';
import CheckIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Block';
import http from '../../api/http.js';

export default function AdminPage() {
    const [section, setSection] = useState('files'); // 'files' | 'agents'
    const [mini, setMini] = useState(false);

    const sidebarWidth = mini ? 72 : 260;

    // Admin files state
    const [files, setFiles] = useState([]);
    const [orderBy, setOrderBy] = useState('id');
    const [order, setOrder] = useState('desc');
    const [selected, setSelected] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuFile, setMenuFile] = useState(null);
    const [filters, setFilters] = useState({ status: 'all', watermark: 'all', signature: 'all', agent: '', time: 'all' });

    const fetchAdminFiles = async () => {
        const { data } = await http.get('/api/admin/files');
        setFiles(data);
    };

    useEffect(() => { if (section === 'files') fetchAdminFiles(); }, [section]);

    const statusLabel = (s) => {
        if (s === 'approved') return { label: 'approved', color: 'success' };
        if (s === 'rejected') return { label: 'disapproved', color: 'default' };
        return { label: 'pending', color: 'default' };
    };

    const filtered = useMemo(() => {
        return files.filter(f => {
            if (filters.status !== 'all') {
                const norm = f.status === 'approved' ? 'approved' : (f.status === 'rejected' ? 'disapproved' : 'pending');
                if (norm !== filters.status) return false;
            }
            if (filters.watermark !== 'all') {
                if (filters.watermark === 'yes' && !f.watermarkApplied) return false;
                if (filters.watermark === 'no' && f.watermarkApplied) return false;
            }
            if (filters.signature !== 'all') {
                if (filters.signature === 'yes' && !f.signatureApplied) return false;
                if (filters.signature === 'no' && f.signatureApplied) return false;
            }
            if (filters.agent) {
                const txt = `${f.uploader?.email || ''}`.toLowerCase();
                if (!txt.includes(filters.agent.toLowerCase())) return false;
            }
            // time filter placeholder: 'all' for now; can expand like agent Dashboard
            return true;
        });
    }, [files, filters]);

    const compare = (a, b, key) => {
        const toTs = (x) => new Date(x || 0).getTime();
        let va, vb;
        switch (key) {
            case 'name': va = a.originalName.toLowerCase(); vb = b.originalName.toLowerCase(); break;
            case 'uploaded': va = toTs(a.createdAt); vb = toTs(b.createdAt); break;
            case 'status': va = (a.status === 'approved') ? 2 : (a.status === 'rejected' ? 1 : 0); vb = (b.status === 'approved') ? 2 : (b.status === 'rejected' ? 1 : 0); break;
            case 'id': default: va = a.id; vb = b.id; break;
        }
        if (va < vb) return -1; if (va > vb) return 1; return 0;
    };

    const sorted = useMemo(() => {
        const out = [...filtered].sort((a, b) => compare(a, b, orderBy));
        return order === 'asc' ? out : out.reverse();
    }, [filtered, orderBy, order]);

    const openMenu = (e, file) => { setAnchorEl(e.currentTarget); setMenuFile(file); };
    const closeMenu = () => { setAnchorEl(null); setMenuFile(null); };

    const handleDownload = async () => {
        if (!menuFile) return;
        try {
            const res = await fetch(`/api/admin/files/${menuFile.id}/download`, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
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

    const handleApprove = async () => {
        if (!menuFile) return;
        await http.post(`/api/admin/files/${menuFile.id}/status`, { action: 'approve' });
        await fetchAdminFiles();
        closeMenu();
    };
    const handleDisapprove = async () => {
        if (!menuFile) return;
        await http.post(`/api/admin/files/${menuFile.id}/status`, { action: 'disapprove' });
        await fetchAdminFiles();
        closeMenu();
    };
    const handleRevert = async () => {
        if (!menuFile) return;
        await http.post(`/api/admin/files/${menuFile.id}/status`, { action: 'revert' });
        await fetchAdminFiles();
        closeMenu();
    };

    const handleSort = (col) => {
        if (orderBy === col) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        else { setOrderBy(col); setOrder('asc'); }
    };

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: `${sidebarWidth}px 1fr` },
                gap: 1.5,
                alignItems: 'stretch',
                height: '100%',
                py: 1,
                pr: { xs: 0, md: 1.5 },
                overflow: 'hidden',
            }}
        >
            {/* Sidebar */}
            <Paper
                elevation={0}
                sx={{
                    height: '100%',
                    width: { xs: '100%', md: sidebarWidth },
                    border: '1px solid #e0e0e0',
                    borderRadius: 2,
                    overflow: 'hidden',
                    transition: (theme) => theme.transitions.create(['width'], {
                        duration: theme.transitions.duration.shorter,
                    }),
                    bgcolor: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: mini ? 'center' : 'space-between', px: 1.5, py: 1 }}>
                    {!mini && (
                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                            Admin
                        </Typography>
                    )}
                    <Tooltip title={mini ? 'Expand' : 'Collapse'}>
                        <IconButton size="small" onClick={() => setMini((v) => !v)}>
                            {mini ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                </Box>
                <Divider />
                <List component="nav" disablePadding sx={{ py: 0.5, flex: 1, overflowY: 'auto' }}>
                    <ListItemButton selected={section === 'files'} onClick={() => setSection('files')} sx={{ px: mini ? 1 : 2, justifyContent: mini ? 'center' : 'flex-start' }}>
                        <ListItemIcon sx={{ minWidth: 0, mr: mini ? 0 : 1.5, color: 'primary.main' }}>
                            <FolderIcon />
                        </ListItemIcon>
                        {!mini && <ListItemText primary="File Management" />}
                    </ListItemButton>
                    <ListItemButton selected={section === 'agents'} onClick={() => setSection('agents')} sx={{ px: mini ? 1 : 2, justifyContent: mini ? 'center' : 'flex-start' }}>
                        <ListItemIcon sx={{ minWidth: 0, mr: mini ? 0 : 1.5, color: 'primary.main' }}>
                            <PeopleIcon />
                        </ListItemIcon>
                        {!mini && <ListItemText primary="Agent" />}
                    </ListItemButton>
                </List>
            </Paper>

            {/* Main Content */}
            <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: { xs: 1.5, md: 2 }, bgcolor: '#fff', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {section === 'files' && (
                    <>
                        {/* Filters */}
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                            <TextField
                                size="small"
                                label="Status"
                                select
                                value={filters.status}
                                onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                                sx={{ minWidth: 120 }}
                            >
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="pending">Pending</MenuItem>
                                <MenuItem value="approved">Approved</MenuItem>
                                <MenuItem value="disapproved">Disapproved</MenuItem>
                            </TextField>
                            <TextField size="small" label="Watermark" select value={filters.watermark} onChange={(e) => setFilters(f => ({ ...f, watermark: e.target.value }))} sx={{ minWidth: 130 }}>
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="yes">Applied</MenuItem>
                                <MenuItem value="no">Not Applied</MenuItem>
                            </TextField>
                            <TextField size="small" label="Signature" select value={filters.signature} onChange={(e) => setFilters(f => ({ ...f, signature: e.target.value }))} sx={{ minWidth: 130 }}>
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="yes">Applied</MenuItem>
                                <MenuItem value="no">Not Applied</MenuItem>
                            </TextField>
                            <TextField size="small" label="Upload Agent (email)" value={filters.agent} onChange={(e) => setFilters(f => ({ ...f, agent: e.target.value }))} sx={{ minWidth: 210 }} />
                            <Button size="small" variant="outlined" onClick={() => setFilters({ status: 'all', watermark: 'all', signature: 'all', agent: '', time: 'all' })}>Clear</Button>
                        </Box>

                        {/* Table */}
                        <TableContainer sx={{ flex: 1, overflowY: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>ID</TableCell>
                                        <TableCell sortDirection={orderBy === 'name' ? order : false}>
                                            <TableSortLabel active={orderBy === 'name'} direction={orderBy === 'name' ? order : 'asc'} onClick={() => handleSort('name')}>Name & Size</TableSortLabel>
                                        </TableCell>
                                        <TableCell>Agent</TableCell>
                                        <TableCell sortDirection={orderBy === 'uploaded' ? order : false}>
                                            <TableSortLabel active={orderBy === 'uploaded'} direction={orderBy === 'uploaded' ? order : 'asc'} onClick={() => handleSort('uploaded')}>Upload date & time</TableSortLabel>
                                        </TableCell>
                                        <TableCell sortDirection={orderBy === 'status' ? order : false}>
                                            <TableSortLabel active={orderBy === 'status'} direction={orderBy === 'status' ? order : 'asc'} onClick={() => handleSort('status')}>Status</TableSortLabel>
                                        </TableCell>
                                        <TableCell>Watermark</TableCell>
                                        <TableCell>Signature</TableCell>
                                        <TableCell align="right">Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {sorted.map((f) => {
                                        const dt = f.createdAt ? new Date(f.createdAt) : null;
                                        const dateStr = dt ? dt.toLocaleDateString() : '-';
                                        const timeStr = dt ? dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
                                        const s = statusLabel(f.status);
                                        const sizeKb = (f.size / 1024).toFixed(1);
                                        return (
                                            <TableRow key={f.id} hover>
                                                <TableCell>{f.id}</TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{f.originalName}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{sizeKb} KB</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2">{f.uploader?.email || '-'}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="caption" sx={{ display: 'block' }}>{dateStr}</Typography>
                                                    <Typography variant="caption" color="text.secondary">{timeStr}</Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip size="small" label={s.label} color={s.color} />
                                                </TableCell>
                                                <TableCell>{f.watermarkApplied ? 'Yes' : 'No'}</TableCell>
                                                <TableCell>{f.signatureApplied ? 'Yes' : 'No'}</TableCell>
                                                <TableCell align="right">
                                                    <IconButton size="small" onClick={(e) => openMenu(e, f)}><MoreVertIcon /></IconButton>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {!sorted.length && (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ py: 6, color: 'text.secondary' }}>No files.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        {/* Row menu */}
                        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
                            <MenuItem onClick={() => { window.open(`/static/${menuFile?.storedName}`, '_blank'); closeMenu(); }}>
                                <MListItemIcon><OpenInNewIcon fontSize="small" /></MListItemIcon>
                                View
                            </MenuItem>
                            {menuFile && (menuFile.status === 'approved' || menuFile.status === 'rejected') ? (
                                <MenuItem onClick={handleRevert}>
                                    <MListItemIcon><UndoIcon fontSize="small" /></MListItemIcon>
                                    Revert to Pending
                                </MenuItem>
                            ) : (
                                <MenuItem onClick={handleApprove}>
                                    <MListItemIcon><CheckIcon fontSize="small" /></MListItemIcon>
                                    Approve
                                </MenuItem>
                            )}
                            {menuFile && menuFile.status !== 'rejected' && (
                                <MenuItem onClick={handleDisapprove}>
                                    <MListItemIcon><CloseIcon fontSize="small" /></MListItemIcon>
                                    Disapprove
                                </MenuItem>
                            )}
                            <MenuItem onClick={handleDownload}>
                                <MListItemIcon><DownloadIcon fontSize="small" /></MListItemIcon>
                                Download
                            </MenuItem>
                        </Menu>
                    </>
                )}

                {section === 'agents' && (
                    <>
                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
                            Admin Dashboard — Agent
                        </Typography>
                        <Typography variant="body1">Welcome, admin.</Typography>
                    </>
                )}
            </Paper>
        </Box>
    );
}
