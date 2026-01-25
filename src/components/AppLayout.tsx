import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Divider,
  ListItemIcon,
  ListItemText,
  Chip,
  Tabs,
  Tab,
  BottomNavigation,
  BottomNavigationAction,
  Paper,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Logout,
  Person,
  AdminPanelSettings,
  Sports,
  Groups as ClubsIcon,
  EmojiEvents as MatchesIcon,
  People as PlayersIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ApprovalStatus, UserRole } from '../types';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const getCurrentTab = () => {
    if (location.pathname.startsWith('/clubs')) return 'clubs';
    if (location.pathname.startsWith('/matches')) return 'matches';
    if (location.pathname.startsWith('/players') && location.pathname !== `/players/${user?._id || user?.id}`) return 'players';
    return false;
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    handleClose();
  };

  const handleProfile = () => {
    if (user?._id || user?.id) {
      navigate(`/players/${user._id || user.id}`);
    }
    handleClose();
  };

  const handleAdmin = () => {
    navigate('/admin');
    handleClose();
  };

  const getStatusChip = () => {
    if (!user) return null;

    if (user.status === ApprovalStatus.PENDING) {
      return (
        <Chip
          label="Pending Approval"
          size="small"
          color="warning"
          sx={{ ml: 1 }}
        />
      );
    }
    if (user.status === ApprovalStatus.APPROVED) {
      return (
        <Chip
          label="Approved"
          size="small"
          color="success"
          sx={{ ml: 1 }}
        />
      );
    }
    return null;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
            onClick={() => navigate('/matches')}
          >
            <Sports />
          </IconButton>
          
          <Typography 
            variant="h6" 
            component="div" 
            sx={{ cursor: 'pointer' }} 
            onClick={() => navigate('/matches')}
          >
            Kite Fighters
          </Typography>

          <Box sx={{ flexGrow: 1 }} />

          <Tabs 
            value={getCurrentTab()} 
            onChange={(_, value) => navigate(`/${value}`)}
            sx={{ mr: 2, display: { xs: 'none', sm: 'flex' } }}
            textColor="inherit"
            TabIndicatorProps={{
              style: { backgroundColor: 'white' }
            }}
          >
            <Tab icon={<MatchesIcon />} label="Matches" value="matches" />
            <Tab icon={<ClubsIcon />} label="Clubs" value="clubs" />
            <Tab icon={<PlayersIcon />} label="Players" value="players" />
          </Tabs>

          {user && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="body2" sx={{ mr: 1, display: { xs: 'none', sm: 'block' } }}>
                {user.name}
              </Typography>
              {getStatusChip()}
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <Avatar sx={{ width: 32, height: 32 }}>
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={handleProfile}>
                  <ListItemIcon>
                    <Person fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>My Profile</ListItemText>
                </MenuItem>
                
                {isAdmin() && (
                  <MenuItem onClick={handleAdmin}>
                    <ListItemIcon>
                      <AdminPanelSettings fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Admin Dashboard</ListItemText>
                  </MenuItem>
                )}
                
                <Divider />
                
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <Logout fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Logout</ListItemText>
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default', pb: { xs: 7, sm: 0 } }}>
        {children}
      </Box>

      {/* Bottom Navigation for Mobile */}
      <Paper 
        sx={{ 
          position: 'fixed', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          display: { xs: 'block', sm: 'none' },
          zIndex: 1000
        }} 
        elevation={3}
      >
        <BottomNavigation
          value={getCurrentTab()}
          onChange={(_, value) => {
            if (value) navigate(`/${value}`);
          }}
          showLabels
        >
          <BottomNavigationAction label="Matches" value="matches" icon={<MatchesIcon />} />
          <BottomNavigationAction label="Clubs" value="clubs" icon={<ClubsIcon />} />
          <BottomNavigationAction label="Players" value="players" icon={<PlayersIcon />} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
};
