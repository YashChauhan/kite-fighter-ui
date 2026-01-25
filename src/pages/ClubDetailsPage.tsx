import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Button,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Chip,
  Grid,
  Paper,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  People as PeopleIcon,
  CalendarToday as CalendarIcon,
  Settings as SettingsIcon,
  PersonAdd as JoinIcon,
} from '@mui/icons-material';
import { getClubById, getClubPlayers } from '../api/clubs';
import type { Club, Player } from '../types';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/notificationService';
import { format } from 'date-fns';
import apiClient from '../api/client';

export default function ClubDetailsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (clubId) {
      loadClubData();
    }
  }, [clubId]);

  const loadClubData = async () => {
    if (!clubId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Try to get club with populated players
      const clubData = await getClubById(clubId, true);
      setClub(clubData);
      
      // Check if players are populated (objects) or just IDs (strings)
      if (Array.isArray(clubData.players) && clubData.players.length > 0) {
        const firstPlayer = clubData.players[0];
        
        if (typeof firstPlayer === 'object' && firstPlayer !== null) {
          // Players are populated, filter by membership status
          const approvedMembers = clubData.players.filter((p: any) => 
            p.membershipStatus === 'approved' || !p.membershipStatus
          );
          setMembers(approvedMembers as Player[]);
        } else {
          // Players are just IDs, try to fetch from /clubs/:id/players endpoint
          try {
            const playersData = await getClubPlayers(clubId);
            const approvedMembers = playersData.data.filter((p: any) => 
              p.membershipStatus === 'approved' || !p.membershipStatus
            );
            setMembers(approvedMembers);
          } catch (playersErr) {
            console.log('Could not fetch club players, will show count only');
            // Can't get player details, just show the count
            setMembers([]);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load club data:', err);
      setError(err.response?.data?.message || 'Failed to load club data');
    } finally {
      setLoading(false);
    }
  };

  const isMember = (): boolean => {
    if (!user) return false;
    return members.some(m => (m._id || m.id) === (user._id || user.id));
  };

  const isOwner = (): boolean => {
    if (!user) return false;
    const member = members.find(m => (m._id || m.id) === (user._id || user.id));
    return member ? (member as any).isOwner === true : false;
  };

  const handleJoinClub = async () => {
    if (!clubId) return;
    
    try {
      setJoining(true);
      await apiClient.post(`/clubs/${clubId}/join`);
      notificationService.success('Join request sent! Waiting for owner approval.');
      // Optionally reload data
      await loadClubData();
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to send join request');
    } finally {
      setJoining(false);
    }
  };

  const handleLeaveClub = async () => {
    if (!clubId) return;
    
    if (!confirm('Are you sure you want to leave this club?')) {
      return;
    }
    
    try {
      await apiClient.post(`/clubs/${clubId}/leave`);
      notificationService.success('Left the club successfully');
      await loadClubData();
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to leave club');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !club) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Club not found'}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/clubs')} sx={{ mt: 2 }}>
          Back to Clubs
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/clubs')} sx={{ mb: 2 }}>
          Back to Clubs
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={3} mb={3}>
                <Avatar sx={{ bgcolor: 'primary.main', width: 80, height: 80, fontSize: '2rem' }}>
                  {club.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="h4" gutterBottom>
                    {club.name}
                  </Typography>
                  <Box display="flex" gap={2} flexWrap="wrap">
                    {isMember() && (
                      <Chip label="Member" color="success" size="small" />
                    )}
                    {isOwner() && (
                      <Chip label="Owner" color="primary" size="small" />
                    )}
                  </Box>
                </Box>
                {isOwner() && (
                  <Button
                    variant="outlined"
                    startIcon={<SettingsIcon />}
                    onClick={() => navigate(`/clubs/${clubId}/manage`)}
                  >
                    Manage
                  </Button>
                )}
              </Box>

              {club.description && (
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom>
                    About
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    {club.description}
                  </Typography>
                </Box>
              )}

              <Box display="flex" gap={3} mb={3} flexWrap="wrap">
                <Box display="flex" alignItems="center" gap={1}>
                  <PeopleIcon color="action" />
                  <Typography variant="body1">
                    {members.length} members
                  </Typography>
                </Box>
                {club.foundedDate && (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CalendarIcon color="action" />
                    <Typography variant="body1">
                      Founded {format(new Date(club.foundedDate), 'MMMM yyyy')}
                    </Typography>
                  </Box>
                )}
              </Box>

              {!isMember() && (
                <Button
                  variant="contained"
                  startIcon={<JoinIcon />}
                  onClick={handleJoinClub}
                  disabled={joining}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  {joining ? 'Sending Request...' : 'Request to Join'}
                </Button>
              )}

              {isMember() && !isOwner() && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={handleLeaveClub}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  Leave Club
                </Button>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          {club.competitiveMatchStats && (
            <Paper sx={{ p: 2, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Match Statistics
              </Typography>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">Wins</Typography>
                <Typography variant="body1" fontWeight="bold" color="success.main">
                  {club.competitiveMatchStats.matchesWon}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="text.secondary">Losses</Typography>
                <Typography variant="body1" fontWeight="bold" color="error.main">
                  {club.competitiveMatchStats.matchesLost}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2" color="text.secondary">Draws</Typography>
                <Typography variant="body1" fontWeight="bold">
                  {club.competitiveMatchStats.matchesDraw}
                </Typography>
              </Box>
            </Paper>
          )}

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Members ({members.length})
              </Typography>
              <List dense>
                {members.slice(0, 10).map((member: any) => (
                  <ListItem key={member._id || member.id} disablePadding sx={{ py: 0.5 }}>
                    <ListItemAvatar>
                      <Avatar sx={{ width: 32, height: 32 }}>
                        {member.name.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={0.5}>
                          <Typography variant="body2">{member.name}</Typography>
                          {member.isOwner && (
                            <Chip label="Owner" size="small" color="primary" sx={{ height: 18 }} />
                          )}
                        </Box>
                      }
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
              {members.length > 10 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  And {members.length - 10} more...
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Container>
  );
}
