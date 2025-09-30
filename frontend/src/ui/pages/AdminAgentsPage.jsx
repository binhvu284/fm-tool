import React, { useEffect, useMemo, useState } from 'react';
import { Box, Paper, Typography, Button, TableContainer, Table, TableHead, TableRow, TableCell, TableBody, IconButton, Menu, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Chip, Tooltip, Stack } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import PersonOffIcon from '@mui/icons-material/PersonOff';
import PersonCheckIcon from '@mui/icons-material/PersonAddAlt1';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import http from '../../api/http.js';

function StatusChip({ active }) {
    return <Chip size="small" label={active ? 'Active' : 'Inactive'} color={active ? 'success' : 'default'} />;
}

export default function AdminAgentsPage() {
    const [agents, setAgents] = useState([]);
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuAgent, setMenuAgent] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', password: '' });
    const [editForm, setEditForm] = useState({ id: null, name: '', email: '', password: '' });
    const [error, setError] = useState('');

    const fetchAgents = async () => {
        try {
            const { data } = await http.get('/api/admin/agents');
            setAgents(Array.isArray(data) ? data : []);
        } catch (e) {
            setAgents([]);
        }
    };

    useEffect(() => { fetchAgents(); }, []);

    const openMenu = (e, agent) => { setAnchorEl(e.currentTarget); setMenuAgent(agent); };
    const closeMenu = () => { setAnchorEl(null); setMenuAgent(null); };

    const openCreate = () => { setForm({ name: '', email: '', password: '' }); setError(''); setCreateOpen(true); };
    const createAgent = async () => {
        setError('');
        try {
            if (!form.email || !form.password) { setError('Email and password are required'); return; }
            await http.post('/api/admin/agents', form);
            setCreateOpen(false);
            await fetchAgents();
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to create agent');
        }
    };

    const openEdit = () => {
        if (!menuAgent) return;
        setEditForm({ id: menuAgent.id, name: menuAgent.name || '', email: menuAgent.email || '', password: '' });
        setError('');
        setEditOpen(true);
        closeMenu();
    };
    const saveEdit = async () => {
        setError('');
        try {
            const payload = { name: editForm.name, email: editForm.email };
            if (editForm.password) payload.password = editForm.password;
            await http.put(`/api/admin/agents/${editForm.id}`, payload);
            setEditOpen(false);
            await fetchAgents();
        } catch (e) {
            setError(e?.response?.data?.message || 'Failed to update');
        }
    };

    const activate = async () => {
        if (!menuAgent) return;
        try { await http.post(`/api/admin/agents/${menuAgent.id}/activate`); await fetchAgents(); } catch { }
        closeMenu();
    };
    const deactivate = async () => {
        if (!menuAgent) return;
        try { await http.post(`/api/admin/agents/${menuAgent.id}/deactivate`); await fetchAgents(); } catch { }
        closeMenu();
    };

    const askDelete = () => { setConfirmOpen(true); closeMenu(); };
    const doDelete = async () => {
        if (!menuAgent) return;
        try { await http.delete(`/api/admin/agents/${menuAgent.id}`); } catch { }
        setConfirmOpen(false);
        await fetchAgents();
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Paper elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: { xs: 1.5, md: 2 }, bgcolor: '#fff', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Agents</Typography>
                    <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>Create Agent</Button>
                </Box>

                <TableContainer sx={{ flex: 1 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Email</TableCell>
                                <TableCell>Create Date</TableCell>
                                <TableCell>Upload Files</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {agents.map(a => {
                                const created = a.createdAt ? new Date(a.createdAt) : null;
                                const dateStr = created ? created.toLocaleDateString() : '-';
                                const uploadCount = a.uploadCount ?? a.files ?? a.fileCount ?? 0; // placeholder; can expand later
                                return (
                                    <TableRow key={a.id} hover>
                                        <TableCell>{a.name || '-'}</TableCell>
                                        <TableCell>{a.email}</TableCell>
                                        <TableCell>{dateStr}</TableCell>
                                        <TableCell>{uploadCount}</TableCell>
                                        <TableCell><StatusChip active={a.active !== false} /></TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={(e) => openMenu(e, a)}><MoreVertIcon /></IconButton>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {!agents.length && (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>No agents.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Row menu */}
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
                <MenuItem onClick={openEdit}>
                    <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
                </MenuItem>
                {menuAgent?.active !== false ? (
                    <MenuItem onClick={deactivate}>
                        <PersonOffIcon fontSize="small" sx={{ mr: 1 }} /> Deactivate
                    </MenuItem>
                ) : (
                    <MenuItem onClick={activate}>
                        <PersonCheckIcon fontSize="small" sx={{ mr: 1 }} /> Activate
                    </MenuItem>
                )}
                <MenuItem onClick={askDelete} sx={{ color: 'error.main' }}>
                    <DeleteIcon fontSize="small" sx={{ mr: 1 }} /> Delete
                </MenuItem>
            </Menu>

            {/* Create dialog */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Agent</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <TextField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth />
                        <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} fullWidth />
                        <TextField label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} fullWidth />
                        {error && <Typography color="error" variant="caption">{error}</Typography>}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={createAgent}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* Edit dialog */}
            <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit Agent</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <TextField label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} fullWidth />
                        <TextField label="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} fullWidth />
                        <TextField label="Password (leave empty to keep)" type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} fullWidth />
                        {error && <Typography color="error" variant="caption">{error}</Typography>}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={saveEdit}>Save</Button>
                </DialogActions>
            </Dialog>

            {/* Delete confirm */}
            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Delete agent</DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2">Are you sure you want to delete this agent? This action cannot be undone.</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
                    <Button color="error" variant="contained" onClick={doDelete}>Delete</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
