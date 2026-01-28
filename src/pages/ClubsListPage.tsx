import { useState, useEffect, useRef } from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  TextField,
  Button,
  Box,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  Avatar,
  Pagination,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  People as PeopleIcon,
  CalendarToday as CalendarIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getClubs, getPendingJoinRequests } from '../api/clubs';
import type { Club } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';
import { getUserClubRole, isUserMemberOfClub } from '../utils/clubPermissions';

export default function ClubsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingRequestCounts, setPendingRequestCounts] = useState<Record<string, number>>({});
  const limit = 12;
  const loadingRequestsRef = useRef(false);

  useEffect(() => {
    loadClubs();
  }, [page, searchTerm]);

  useEffect(() => {
    // Load pending request counts for clubs where user is owner/co-owner
    // Only run once per clubs array change, not on every re-render
    if (user && clubs.length > 0 && !loadingRequestsRef.current) {
      loadPendingRequestCounts();
    }
  }, [clubs.length, user?._id]);

  const loadPendingRequestCounts = async () => {
    if (!user || loadingRequestsRef.current) return;
    
    loadingRequestsRef.current = true;
    console.log('=== 🚀 Loading Pending Request Counts ===');
    console.log('User ID:', user._id || user.id);
    console.log('User clubs:', user.clubs);
    console.log('Total clubs on page:', clubs.length);
    
    const counts: Record<string, number> = {};
    
    for (const club of clubs) {
      const clubId = club._id || club.id;
      if (!clubId) continue;
      
      // Skip clubs user is not a member of
      if (!isUserMemberOfClub(user, clubId)) {
        console.log(`⏭️  Skipping "${club.name}" - user is not a member`);
        continue;
      }
      
      console.log(`\n--- Checking club: "${club.name}" (${clubId}) ---`);
      
      try {
        const role = await getUserClubRole(user, clubId);
        console.log(`⭐ Final role for "${club.name}": ${role}`);
        
        if (role === 'owner' || role === 'co_owner') {
          // User is owner/co-owner, get pending requests
          console.log(`✅ User is ${role}, fetching pending requests...`);
          const requests = await getPendingJoinRequests(clubId);
          console.log(`📬 Pending requests for ${club.name}:`, requests);
          const pendingCount = requests.filter(req => req.status === 'pending').length;
          console.log(`📊 Pending count: ${pendingCount}`);
          if (pendingCount > 0) {
            counts[clubId] = pendingCount;
          }
        } else {
          console.log(`❌ User is ${role}, skipping pending requests check`);
        }
      } catch (err) {
        console.error(`❌ Failed to load pending requests for club ${clubId}:`, err);
      }
    }
    
    console.log('\n=== 🏁 Final pending request counts ===', counts);
    setPendingRequestCounts(counts);
    loadingRequestsRef.current = false;
  };

  const loadClubs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getClubs({
        page,
        limit,
        search: searchTerm || undefined,
        status: 'approved',
      });
      setClubs(response.data);
      setTotalPages(response.pagination.totalPages);
    } catch (err: any) {
      console.error('Failed to load clubs:', err);
      setError(err.response?.data?.message || 'Failed to load clubs');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const isOwner = (club: Club): boolean => {
    if (!user) return false;
    // Check if user is in the players array and get the player object
    const players = Array.isArray(club.players) ? club.players : [];
    const userPlayer = players.find((p: any) => 
      typeof p === 'string' 
        ? p === (user._id || user.id)
        : (p._id || p.id) === (user._id || user.id)
    );
    
    // If we have the full player object, check if they're the owner
    if (userPlayer && typeof userPlayer === 'object') {
      return userPlayer.isOwner === true;
    }
    
    return false;
  };

  const getMemberCount = (club: Club): number => {
    return Array.isArray(club.players) ? club.players.length : 0;
  };

  if (loading && page === 1) {
    return (
      <Container maxWidth={false} sx={{ py: 4, px: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4, px: { xs: 2, sm: 3, md: 4 } }}>
      {/* DEBUG PANEL - Remove after testing */}
      {process.env.NODE_ENV === 'development' && user && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2" fontWeight="bold">DEBUG INFO:</Typography>
          <Typography variant="caption" display="block">
            User ID: {user._id || user.id}
          </Typography>
          <Typography variant="caption" display="block">
            User clubs count: {Array.isArray(user.clubs) ? user.clubs.length : 0}
          </Typography>
          <Typography variant="caption" display="block">
            User clubs data: {JSON.stringify(user.clubs, null, 2).substring(0, 300)}...
          </Typography>
          <Typography variant="caption" display="block">
            Pending request counts: {JSON.stringify(pendingRequestCounts)}
          </Typography>
          <Typography variant="caption" display="block">
            Total clubs on page: {clubs.length}
          </Typography>
        </Alert>
      )}

      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Kite Fighter Clubs
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Discover and join kite fighting clubs in your area
        </Typography>

        <TextField
          fullWidth
          placeholder="Search clubs..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          sx={{ mt: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Pending Requests Notification Banner */}
      {Object.keys(pendingRequestCounts).length > 0 && (
        <Alert 
          severity="warning" 
          icon={<NotificationsIcon />}
          sx={{ mb: 3 }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight="bold">
              Pending Join Requests
            </Typography>
            <Typography variant="body2">
              You have pending join requests for your clubs. Click on a club card below to review them.
            </Typography>
            {Object.entries(pendingRequestCounts).map(([clubId, count]) => {
              const club = clubs.find(c => (c._id || c.id) === clubId);
              return club ? (
                <Typography key={clubId} variant="body2" sx={{ mt: 0.5 }}>
                  • <strong>{club.name}</strong>: {count} pending request{count > 1 ? 's' : ''}
                </Typography>
              ) : null;
            })}
          </Box>
        </Alert>
      )}

      {clubs.length === 0 && !loading ? (
        <Alert severity="info">No clubs found</Alert>
      ) : (
        <>
          <Grid container spacing={3} sx={{ width: '100%', m: 0 }}>
            {clubs.map((club) => (
              <Grid item xs={12} key={club._id || club.id} sx={{ width: '100%' }}>
                <Card 
                  sx={{ 
                    width: '100%',
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    position: 'relative',
                  }}
                >
                  {isOwner(club) && (
                    <Chip
                      label="Owner"
                      color="primary"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 1,
                      }}
                    />
                  )}
                  
                  {/* Show pending join request badge for owners/co-owners */}
                  {pendingRequestCounts[(club._id || club.id) as string] > 0 && (
                    <Chip
                      icon={<NotificationsIcon />}
                      label={`${pendingRequestCounts[(club._id || club.id) as string]} pending request${pendingRequestCounts[(club._id || club.id) as string] > 1 ? 's' : ''}`}
                      color="warning"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: isOwner(club) ? 44 : 12,
                        right: 12,
                        zIndex: 1,
                      }}
                    />
                  )}
                  
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                      <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56 }}>
                        {club.name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box flex={1}>
                        <Typography variant="h6" component="h2">
                          {club.name}
                        </Typography>
                      </Box>
                    </Box>

                    {club.description && (
                      <Typography 
                        variant="body2" 
                        color="text.secondary" 
                        sx={{ 
                          mb: 2,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {club.description}
                      </Typography>
                    )}

                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <PeopleIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        {getMemberCount(club)} members
                      </Typography>
                    </Box>

                    {club.foundedDate && (
                      <Box display="flex" alignItems="center" gap={1}>
                        <CalendarIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          Founded {format(new Date(club.foundedDate), 'MMM yyyy')}
                        </Typography>
                      </Box>
                    )}

                    {club.competitiveMatchStats && (
                      <Box mt={2}>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Match Record
                        </Typography>
                        <Typography variant="body2">
                          {club.competitiveMatchStats.matchesWon}W - {club.competitiveMatchStats.matchesLost}L - {club.competitiveMatchStats.matchesDraw}D
                        </Typography>
                      </Box>
                    )}
                  </CardContent>

                  <CardActions>
                    <Button 
                      size="small" 
                      onClick={() => navigate(`/clubs/${club._id || club.id}`)}
                      fullWidth
                    >
                      View Details
                    </Button>
                    {isOwner(club) && (
                      <Button
                        size="small"
                        startIcon={<SettingsIcon />}
                        onClick={() => navigate(`/clubs/${club._id || club.id}/manage`)}
                        variant="outlined"
                      >
                        Manage
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {totalPages > 1 && (
            <Box display="flex" justifyContent="center" mt={4}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            </Box>
          )}

          {loading && (
            <Box display="flex" justifyContent="center" mt={3}>
              <CircularProgress size={24} />
            </Box>
          )}
        </>
      )}
    </Container>
  );
}
