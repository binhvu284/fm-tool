import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Divider,
  Button
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WaterIcon from '@mui/icons-material/Opacity';
import SignIcon from '@mui/icons-material/BorderColor';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import { useLocation, useNavigate } from 'react-router-dom';

const nav = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/watermark', label: 'Watermark', icon: <WaterIcon /> },
  { to: '/signature', label: 'Signature', icon: <SignIcon /> }
];

export default function SaaSLayout({ children, pageTitle }) {
  const [open, setOpen] = React.useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  // Get current page title and icon based on location if not provided
  const getCurrentPageInfo = () => {
    if (pageTitle) {
      const currentNav = nav.find(n => n.to === location.pathname);
      return { 
        title: pageTitle, 
        icon: currentNav ? currentNav.icon : <DashboardIcon />
      };
    }
    const currentNav = nav.find(n => n.to === location.pathname);
    return currentNav ? 
      { title: currentNav.label, icon: currentNav.icon } : 
      { title: 'FM Tool', icon: <DashboardIcon /> };
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f7f8fb' }}>
      <AppBar 
        elevation={0} 
        position="fixed" 
        color="inherit" 
        sx={{ 
          borderBottom: '1px solid #eee',
          width: `calc(100% - ${open ? 240 : 72}px)`,
          ml: `${open ? 240 : 72}px`,
          transition: (theme) => theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>FM Tool</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', ml: 4 }}>
            {getCurrentPageInfo().icon}
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', ml: 1 }}>
              {getCurrentPageInfo().title}
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <Button onClick={logout} startIcon={<LogoutIcon />} color="primary">Logout</Button>
          <Avatar sx={{ ml: 2, bgcolor: 'primary.main' }}>U</Avatar>
        </Toolbar>
      </AppBar>

      <Drawer variant="permanent" open={open} sx={{
        width: open ? 240 : 72,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: open ? 240 : 72,
          boxSizing: 'border-box',
          borderRight: '1px solid #eee'
        }
      }}>
        <Toolbar sx={{ display: 'flex', justifyContent: open ? 'flex-end' : 'center' }}>
          <IconButton onClick={() => setOpen((v) => !v)} sx={{ color: 'primary.main' }}>
            <MenuIcon />
          </IconButton>
        </Toolbar>
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {nav.map((n) => (
              <ListItemButton key={n.to} selected={location.pathname === n.to} onClick={() => navigate(n.to)}>
                <ListItemIcon>{n.icon}</ListItemIcon>
                <ListItemText primary={n.label} />
              </ListItemButton>
            ))}
          </List>
          <Divider />
        </Box>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>{children}</Box>
      </Box>
    </Box>
  );
}
