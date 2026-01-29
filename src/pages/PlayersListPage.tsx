import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  EmojiEvents as TrophyIcon,
  Whatshot as StreakIcon,
} from '@mui/icons-material';
import { getPlayers } from '../api/players';
import type { Player } from '../types';
import { ApprovalStatus } from '../types';

export default function PlayersListPage() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 12;

  useEffect(() => {
    loadPlayers();
  }, [page, searchTerm]);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getPlayers({
        page,
        limit,
        search: searchTerm || undefined,
      });
      // Filter only approved players
      const approvedPlayers = response.data.filter(p => p.status === ApprovalStatus.APPROVED);
      setPlayers(approvedPlayers);
      setTotalPages(response.pagination.totalPages);
    } catch (err: any) {
      console.error('Failed to load players:', err);
      setError(err.response?.data?.message || 'Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setPage(1);
  };

  const getTotalFights = (player: Player): number => {
    return (player.fightStats?.training?.total || 0) + (player.fightStats?.competitive?.total || 0);
  };

  const getWinRate = (player: Player): number => {
    const total = getTotalFights(player);
    if (total === 0) return 0;
    const wins = (player.fightStats?.training?.wins || 0) + (player.fightStats?.competitive?.wins || 0);
    return Math.round((wins / total) * 100);
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          Kite Fighter Players
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Browse all registered kite fighters
        </Typography>

        <TextField
          fullWidth
          placeholder="Search players..."
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

      {players.length === 0 && !loading ? (
        <Alert severity="info">No players found</Alert>
      ) : (
        <>
          <Grid container spacing={3} sx={{ width: '100%', m: 0 }}>
            {players.map((player) => {
              const totalFights = getTotalFights(player);
              const winRate = getWinRate(player);
              
              return (
                <Grid item xs={12} key={player._id || player.id} sx={{ width: '100%' }}>
                  <Card 
                    sx={{ 
                      width: '100%',
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4,
                      }
                    }}
                    onClick={() => navigate(`/players/${player._id || player.id}`)}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <Avatar 
                          sx={{ 
                            bgcolor: 'primary.main', 
                            width: 56, 
                            height: 56,
                            fontSize: '1.5rem'
                          }}
                        >
                          {player.name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box flex={1}>
                          <Typography variant="h6" component="h2">
                            {player.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {player.email}
                          </Typography>
                        </Box>
                      </Box>

                      {totalFights > 0 && (
                        <>
                          <Box mb={2}>
                            <Box display="flex" justifyContent="space-between" mb={0.5}>
                              <Typography variant="body2" color="text.secondary">
                                Win Rate
                              </Typography>
                              <Typography variant="body2" fontWeight="bold">
                                {winRate}%
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={winRate} 
                              sx={{ height: 6, borderRadius: 3 }}
                            />
                          </Box>

                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" color="text.secondary">
                              Total Fights
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {totalFights}
                            </Typography>
                          </Box>

                          <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="body2" color="text.secondary">
                              Competitive
                            </Typography>
                            <Typography variant="body2">
                              {player.fightStats?.competitive?.wins || 0}W - 
                              {player.fightStats?.competitive?.losses || 0}L - 
                              {player.fightStats?.competitive?.draws || 0}D
                            </Typography>
                          </Box>
                        </>
                      )}

                      {player.currentStreak && player.currentStreak.count > 0 && player.currentStreak.active && (
                        <Box display="flex" alignItems="center" gap={1} mt={2}>
                          <StreakIcon fontSize="small" color="warning" />
                          <Typography variant="body2" color="warning.main" fontWeight="bold">
                            {player.currentStreak.count} {player.currentStreak.type || 'Win'} Streak
                          </Typography>
                        </Box>
                      )}

                      {player.starTrophies && player.starTrophies.length > 0 && (
                        <Box display="flex" alignItems="center" gap={1} mt={1}>
                          <TrophyIcon fontSize="small" color="secondary" />
                          <Typography variant="body2" color="text.secondary">
                            {player.starTrophies.length} Star {player.starTrophies.length === 1 ? 'Trophy' : 'Trophies'}
                          </Typography>
                        </Box>
                      )}

                      {totalFights === 0 && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                          No fights recorded yet
                        </Alert>
                      )}
                    </CardContent>

                    <CardActions>
                      <Button 
                        size="small" 
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/players/${player._id || player.id}`);
                        }}
                      >
                        View Profile
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              );
            })}
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
