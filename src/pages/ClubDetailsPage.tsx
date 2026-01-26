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
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  People as PeopleIcon,
  CalendarToday as CalendarIcon,
  PersonAdd as JoinIcon,
  Info as InfoIcon,
  AdminPanelSettings as ManageIcon,
} from '@mui/icons-material';
import { getClubById, getClubPlayers, requestJoinClub, leaveClub, getClubMembers } from '../api/clubs';
import type { Club, Player } from '../types';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/notificationService';
import { format } from 'date-fns';
import ClubMembershipManagement from '../components/ClubMembershipManagement';

export default function ClubDetailsPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [userRole, setUserRole] = useState<'owner' | 'co_owner' | 'member' | null>(null);

  useEffect(() => {
    if (clubId && user) {
      loadClubData();
    }
  }, [clubId, user]);

  const loadClubData = async () => {
    if (!clubId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Try to get club with populated players
      const clubData = await getClubById(clubId, true);
      setClub(clubData);
      
      // Fetch club members with roles
      try {
        const clubMembersData = await getClubMembers(clubId);
        console.log('Club members data:', clubMembersData);
        console.log('Current user:', user);
        
        if (user) {
          const currentUserMember = clubMembersData.find(
            (m) => {
              const memberPlayerId = m.playerId._id || m.playerId;
              const userId = user._id || user.id;
              console.log('Comparing:', memberPlayerId, 'with', userId);
              return memberPlayerId === userId;
            }
          );
          console.log('Found user membership:', currentUserMember);
          setUserRole(currentUserMember?.role || null);
          console.log('Set userRole to:', currentUserMember?.role || null);
        }
      } catch (err) {
        console.error('Could not fetch club members with roles:', err);
      }
      
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
    return userRole === 'owner';
  };
  
  const isOwnerOrCoOwner = (): boolean => {
    return userRole === 'owner' || userRole === 'co_owner';
  };

  const handleJoinClub = async () => {
    if (!clubId) return;
    
    try {
      setJoining(true);
      const result = await requestJoinClub(clubId, 'I would like to join your club');
      notificationService.success(result.message || 'Join request sent! Waiting for owner approval.');
      // Reload club data to reflect updated status
      await loadClubData();
    } catch (err: any) {
      const errorData = err.response?.data || err;
      const errorCode = errorData.code || errorData.statusCode;
      const errorMessage = errorData.message || 'Failed to send join request';
      
      // Handle specific error cases from the API guide
      if (errorCode === 'VALIDATION_ERROR') {
        if (errorMessage.includes('already a member')) {
          notificationService.error('You are already a member of this club');
        } else if (errorMessage.includes('already pending')) {
          notificationService.error('You already have a pending join request for this club');
        } else {
          notificationService.error(errorMessage);
        }
      } else if (errorCode === 'UNAUTHORIZED' || errorCode === 401) {
        notificationService.error('Please log in to join a club');
      } else if (errorCode === 'NOT_FOUND' || errorCode === 404) {
        notificationService.error('Club not found');
      } else if (errorCode === 429) {
        notificationService.error('Too many requests. Please try again later.');
      } else {
        notificationService.error(errorMessage);
      }
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
      const result = await leaveClub(clubId);
      notificationService.success(result.message || 'Left the club successfully');
      await loadClubData();
    } catch (err: any) {
      const errorData = err.response?.data || err;
      const errorMessage = errorData.message || 'Failed to leave club';
      notificationService.error(errorMessage);
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

      <Box display="flex" gap={3} sx={{ flexDirection: { xs: 'column', md: 'row' } }}>
        <Box flex={1} sx={{ maxWidth: { md: '66%' } }}>
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
                    {userRole === 'co_owner' && (
                      <Chip label="Co-Owner" color="secondary" size="small" />
                    )}
                    {isOwner() && (
                      <Chip label="Owner" color="primary" size="small" />
                    )}
                  </Box>
                </Box>
              </Box>
              
              {/* Debug output */}
              {process.env.NODE_ENV === 'development' && (
                <Box mb={2} p={2} bgcolor="grey.100" borderRadius={1}>
                  <Typography variant="caption" display="block">
                    Debug Info:
                  </Typography>
                  <Typography variant="caption" display="block">
                    User Role: {userRole || 'null'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    isOwnerOrCoOwner(): {isOwnerOrCoOwner().toString()}
                  </Typography>
                  <Typography variant="caption" display="block">
                    User ID: {user?._id || user?.id || 'null'}
                  </Typography>
                </Box>
              )}
              
              {isOwnerOrCoOwner() && (
                <Tabs
                  value={activeTab}
                  onChange={(_, value) => setActiveTab(value)}
                  sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
                >
                  <Tab icon={<InfoIcon />} label="About" />
                  <Tab icon={<ManageIcon />} label="Manage Members" />
                </Tabs>
              )}

              {(activeTab === 0 || !isOwnerOrCoOwner()) && (
                <>
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
                </>
              )}
              
              {activeTab === 1 && isOwnerOrCoOwner() && (
                <ClubMembershipManagement 
                  clubId={clubId!} 
                  onUpdate={loadClubData}
                />
              )}
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ width: { xs: '100%', md: '33%' } }}>
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
        </Box>
      </Box>
    </Container>
  );
}
