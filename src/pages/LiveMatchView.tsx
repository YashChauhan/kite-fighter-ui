import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Alert,
  CircularProgress,
  Snackbar,
  Divider,
  useTheme,
  useMediaQuery,
  Button,
  Drawer,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  EmojiEvents as TrophyIcon,
  Wifi as ConnectedIcon,
  WifiOff as DisconnectedIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

import type { Match, Fight } from '../types';
import { FightStatus, MatchStatus } from '../types';
import { getMatchById } from '../api/matches';
import { getFights } from '../api/fights';
import { useAuth } from '../contexts/AuthContext';
import socketService from '../services/socketService';
import notificationService from '../services/notificationService';
import { offlineService } from '../services/offlineService';
import RecordFightForm from '../components/RecordFightForm';

const STAR_COLORS: Record<string, string> = {
  'GREEN': '#4CAF50',
  'GOLDEN': '#FFD700',
  'RAINBOW': '#9C27B0',
};

export default function LiveMatchView() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [fights, setFights] = useState<Fight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [showConnectionStatus, setShowConnectionStatus] = useState(false);
  const [recordDrawerOpen, setRecordDrawerOpen] = useState(false);

  const streakScrollRef = useRef<HTMLDivElement>(null);

  // Load match data
  useEffect(() => {
    if (!matchId) return;

    const loadMatch = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to load from cache first
        const cached = await offlineService.getCachedMatch(matchId);
        if (cached) {
          setMatch(cached);
        }

        // Then fetch from API
        const fetchedMatch = await getMatchById(matchId);
        setMatch(fetchedMatch);

        // Cache it
        await offlineService.cacheMatch(fetchedMatch);

        // Load fights
        const fightsResponse = await getFights({ matchId: matchId });
        setFights(fightsResponse.data);
      } catch (err: any) {
        console.error('Failed to load match:', err);
        setError(err.response?.data?.message || 'Failed to load match');
        notificationService.error('Failed to load match');
      } finally {
        setLoading(false);
      }
    };

    loadMatch();
  }, [matchId]);

  // Socket.io real-time updates
  useEffect(() => {
    if (!matchId) return;

    socketService.connect();
    socketService.joinMatchRoom(matchId);

    // Connection status
    const handleConnect = () => {
      setConnected(true);
      setShowConnectionStatus(true);
    };

    const handleDisconnect = () => {
      setConnected(false);
      setShowConnectionStatus(true);
    };

    socketService.on('connect', handleConnect);
    socketService.on('disconnect', handleDisconnect);

    // Match events (using new native WebSocket event names)
    const unsubMatchStarting = socketService.onMatchStarted((message: any) => {
      if (message.matchId === matchId) {
        setMatch(prev => prev ? { ...prev, status: MatchStatus.ACTIVE } : null);
        notificationService.info('Match has started!');
      }
    });

    const unsubFightReported = socketService.onFightReported((message: any) => {
      if (message.matchId === matchId && message.data?.fight) {
        setFights(prev => [...prev, message.data.fight]);
        const winner = message.data.fight.proposedResult;
        notificationService.info(`Fight reported: ${winner}`);
      }
    });

    const unsubFightConfirmed = socketService.onFightConfirmed((message: any) => {
      if (message.matchId === matchId && message.data?.fight) {
        setFights(prev =>
          prev.map(f => f.id === message.data.fight._id ? { 
            ...f, 
            status: FightStatus.CONFIRMED 
          } : f)
        );
        notificationService.success('Fight confirmed!');
        
        // Auto-scroll to latest fight
        setTimeout(() => {
          if (streakScrollRef.current) {
            streakScrollRef.current.scrollLeft = streakScrollRef.current.scrollWidth;
          }
        }, 100);
      }
    });

    const unsubMatchCompleted = socketService.onMatchCompleted((message: any) => {
      if (message.matchId === matchId && message.data?.match) {
        setMatch(prev => prev ? {
          ...prev,
          status: MatchStatus.COMPLETED,
          winnerTeam: message.data.match.winnerTeam,
        } : null);
        notificationService.success(`Match completed! Winner: Team ${message.data.match.winnerTeam}`);
      }
    });

    return () => {
      socketService.off('connect', handleConnect);
      socketService.off('disconnect', handleDisconnect);
      unsubMatchStarting();
      unsubFightReported();
      unsubFightConfirmed();
      unsubMatchCompleted();
      socketService.leaveMatchRoom(matchId);
    };
  }, [matchId]);

  // Auto-hide connection status
  useEffect(() => {
    if (showConnectionStatus) {
      const timer = setTimeout(() => setShowConnectionStatus(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showConnectionStatus]);

  const isSpectator = !match || (
    !match.team1.players.some((p: any) => p.id === user?.id) &&
    !match.team2.players.some((p: any) => p.id === user?.id)
  );

  const isCaptain = match && (
    match.team1.captain.id === user?.id ||
    match.team2.captain.id === user?.id
  );

  const confirmedFights = fights.filter(f => f.status === FightStatus.CONFIRMED);
  const team1Score = confirmedFights.filter(f => f.winner?.id && match?.team1.players.some((p: any) => p.id === f.winner?.id)).length;
  const team2Score = confirmedFights.filter(f => f.winner?.id && match?.team2.players.some((p: any) => p.id === f.winner?.id)).length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !match) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error || 'Match not found'}</Alert>
        <Button onClick={() => navigate('/matches')} sx={{ mt: 2 }}>
          Back to Matches
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 10 }}>
      {/* Header */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          p: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <IconButton onClick={() => navigate('/matches')}>
            <BackIcon />
          </IconButton>
          <Box flex={1}>
            <Typography variant="h6">
              {match.team1.club?.name || 'Team 1'} vs {match.team2.club?.name || 'Team 2'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {format(new Date(match.scheduledAt), 'PPp')}
            </Typography>
          </Box>
          <IconButton size="small">
            {connected ? <ConnectedIcon color="success" /> : <DisconnectedIcon color="error" />}
          </IconButton>
        </Box>

        {/* Status Chips */}
        <Box display="flex" gap={1} mt={1}>
          <Chip label={match.status} color={match.status === MatchStatus.ACTIVE ? 'success' : 'default'} size="small" />
          <Chip label={match.type || match.matchType} variant="outlined" size="small" />
          {isSpectator && <Chip label="Spectator Mode" color="info" size="small" />}
        </Box>
      </Box>

      {/* Score */}
      <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'background.default' }}>
        <Typography variant="h3" component="div" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
          <span>{team1Score}</span>
          <Typography variant="h5" color="text.secondary">-</Typography>
          <span>{team2Score}</span>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {confirmedFights.length} fights completed
        </Typography>
      </Box>

      {/* Streak Visualization */}
      <Box sx={{ px: 2, py: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Fight History
        </Typography>
        <Box
          ref={streakScrollRef}
          sx={{
            display: 'flex',
            gap: 1,
            overflowX: 'auto',
            pb: 1,
            '&::-webkit-scrollbar': {
              height: 8,
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'divider',
              borderRadius: 1,
            },
          }}
        >
          {confirmedFights.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No fights recorded yet
            </Typography>
          ) : (
            confirmedFights.map((fight, index) => {
              const isTeam1Win = match.team1.players.some((p: any) => p.id === fight.winner?.id);
              return (
                <Box
                  key={fight.id || fight._id}
                  sx={{
                    minWidth: 40,
                    height: 40,
                    borderRadius: '50%',
                    bgcolor: isTeam1Win ? 'primary.main' : 'secondary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold',
                  }}
                >
                  {index + 1}
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      <Divider />

      {/* Team 1 */}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {match.team1.club?.name || 'Team 1'}
        </Typography>
        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
          Captain: {match.team1.captain?.name || 'Unknown'}
        </Typography>
        {match.team1.players.map((player: any) => (
          <Card key={player.id || player._id} sx={{ mb: 1 }}>
            <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  {player.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="body1">{player.name}</Typography>
                  {player.starTrophies && player.starTrophies.length > 0 && (
                    <Box display="flex" gap={0.5} mt={0.5}>
                      {player.starTrophies.slice(0, 3).map((trophy: any, idx: number) => (
                        <TrophyIcon
                          key={idx}
                          sx={{ fontSize: 16, color: STAR_COLORS[trophy.starType] }}
                        />
                      ))}
                      {player.starTrophies.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{player.starTrophies.length - 3}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
                {player.currentStreak && player.currentStreak.count > 0 && (
                  <Chip
                    label={`${player.currentStreak.count} streak`}
                    size="small"
                    color={player.currentStreak.count >= 3 ? 'success' : 'default'}
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Divider />

      {/* Team 2 */}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {match.team2.club?.name || 'Team 2'}
        </Typography>
        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
          Captain: {match.team2.captain?.name || 'Unknown'}
        </Typography>
        {match.team2.players.map((player: any) => (
          <Card key={player.id || player._id} sx={{ mb: 1 }}>
            <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ bgcolor: 'secondary.main' }}>
                  {player.name.charAt(0).toUpperCase()}
                </Avatar>
                <Box flex={1}>
                  <Typography variant="body1">{player.name}</Typography>
                  {player.starTrophies && player.starTrophies.length > 0 && (
                    <Box display="flex" gap={0.5} mt={0.5}>
                      {player.starTrophies.slice(0, 3).map((trophy: any, idx: number) => (
                        <TrophyIcon
                          key={idx}
                          sx={{ fontSize: 16, color: STAR_COLORS[trophy.starType] }}
                        />
                      ))}
                      {player.starTrophies.length > 3 && (
                        <Typography variant="caption" color="text.secondary">
                          +{player.starTrophies.length - 3}
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
                {player.currentStreak && player.currentStreak.count > 0 && (
                  <Chip
                    label={`${player.currentStreak.count} streak`}
                    size="small"
                    color={player.currentStreak.count >= 3 ? 'success' : 'default'}
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Record Fight Button (for captains) */}
      {isCaptain && match.status === MatchStatus.ACTIVE && (
        <Box
          sx={{
            position: 'fixed',
            bottom: isMobile ? 72 : 16,
            right: 16,
            left: 16,
            mx: 'auto',
            maxWidth: 400,
          }}
        >
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<AddIcon />}
            onClick={() => setRecordDrawerOpen(true)}
            sx={{ height: 48 }}
          >
            Record Fight
          </Button>
        </Box>
      )}

      {/* Connection Status Snackbar */}
      <Snackbar
        open={showConnectionStatus}
        autoHideDuration={3000}
        onClose={() => setShowConnectionStatus(false)}
        message={connected ? 'Connected to live updates' : 'Disconnected from live updates'}
      />

      {/* Record Fight Drawer */}
      <Drawer
        anchor="bottom"
        open={recordDrawerOpen}
        onClose={() => setRecordDrawerOpen(false)}
      >
        {match && (
          <RecordFightForm
            matchId={match.id}
            team1Players={match.team1.players}
            team2Players={match.team2.players}
            onSuccess={() => {
              setRecordDrawerOpen(false);
              // Reload fights
              if (matchId) {
                getFights({ matchId }).then((response) => {
                  setFights(response.data);
                });
              }
            }}
            onCancel={() => setRecordDrawerOpen(false)}
          />
        )}
      </Drawer>
    </Box>
  );
}
