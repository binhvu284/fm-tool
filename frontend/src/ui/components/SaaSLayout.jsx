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
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import { useLocation, useNavigate } from 'react-router-dom';

const userNav = [
  { to: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { to: '/watermark', label: 'Watermark', icon: <WaterIcon /> },
  { to: '/signature', label: 'Signature', icon: <SignIcon /> }
];

export default function SaaSLayout({ children, pageTitle, hideSidebar = false, fullWidthContent = false }) {
  const [open, setOpen] = React.useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    navigate('/login');
  };

  // Build nav with optional admin items
  const role = typeof window !== 'undefined' ? localStorage.getItem('role') : null;
  const nav = React.useMemo(() => {
    if (role === 'admin') {
      return [
        { to: '/admin-files', label: 'File Management', icon: <AdminPanelSettingsIcon /> },
        { to: '/admin-agents', label: 'Agent', icon: <PeopleIcon /> },
      ];
    }
    return userNav;
  }, [role]);

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

  const drawerWidth = 240;
  const miniWidth = 72;
  const appBarWidth = hideSidebar ? '100%' : `calc(100% - ${open ? drawerWidth : miniWidth}px)`;
  const appBarMarginLeft = hideSidebar ? 0 : (open ? drawerWidth : miniWidth);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f7f8fb' }}>
      <AppBar
        elevation={0}
        position="fixed"
        color="inherit"
        sx={{
          borderBottom: '1px solid #eee',
          width: appBarWidth,
          ml: appBarMarginLeft,
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

      {!hideSidebar && (
        <Drawer variant="permanent" open={open} sx={{
          width: open ? drawerWidth : miniWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? drawerWidth : miniWidth,
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
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 2 },
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <Toolbar />
        {fullWidthContent ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</Box>
        ) : (
          <Box sx={{ maxWidth: 1100, mx: 'auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</Box>
        )}
      </Box>
    </Box>
  );
}
