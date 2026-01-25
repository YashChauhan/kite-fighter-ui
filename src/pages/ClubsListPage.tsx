import { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Search as SearchIcon,
  People as PeopleIcon,
  CalendarToday as CalendarIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getClubs } from '../api/clubs';
import type { Club } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

export default function ClubsListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 12;

  useEffect(() => {
    loadClubs();
  }, [page, searchTerm]);

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
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
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

      {clubs.length === 0 && !loading ? (
        <Alert severity="info">No clubs found</Alert>
      ) : (
        <>
          <Grid container spacing={3}>
            {clubs.map((club) => (
              <Grid item xs={12} sm={6} md={4} key={club._id || club.id}>
                <Card 
                  sx={{ 
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
