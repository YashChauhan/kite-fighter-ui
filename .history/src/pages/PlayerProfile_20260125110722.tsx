import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  IconButton,
  Divider,
  TextField,
  Button,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  EmojiEvents as TrophyIcon,
  Whatshot as FireIcon,
  SportsKabaddi as FightIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';

import type { Player, Fight } from '../types';
import { FightStatus } from '../types';
import { getPlayerById, updatePlayer } from '../api/players';
import { getFights } from '../api/fights';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/notificationService';

const STAR_COLORS: Record<string, string> = {
  'GREEN': '#00C853',
  'GOLDEN': '#FFD700',
  'RAINBOW': '#E91E63',
};

export default function PlayerProfile() {
  const { playerId } = useParams<{ playerId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();

  const [player, setPlayer] = useState<Player | null>(null);
  const [fights, setFights] = useState<Fight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [saving, setSaving] = useState(false);

  const isOwnProfile = (user?._id || user?.id) === playerId;
  const canEditName = isOwnProfile;

  // Load player data
  useEffect(() => {
    if (!playerId) return;

    const loadPlayer = async () => {
      try {
        setLoading(true);
        setError(null);

        const fetchedPlayer = await getPlayerById(playerId);
        setPlayer(fetchedPlayer);
        setEditedName(fetchedPlayer.name);

        // Note: Fight history by player is not supported by the API
        // The API only provides fight statistics (wins/losses/draws) in the player object
        // Individual fight records can only be retrieved by match ID
        setFights([]);
      } catch (err: any) {
        console.error('Failed to load player:', err);
        setError(err.response?.data?.message || 'Failed to load player');
        notificationService.error('Failed to load player');
      } finally {
        setLoading(false);
      }
    };

    loadPlayer();
  }, [playerId]);

  const handleSave = async () => {
    if (!player) return;

    try {
      setSaving(true);
      const updated = await updatePlayer(player._id || player.id, { name: editedName });
      setPlayer(updated);
      setEditing(false);
      notificationService.success('Profile updated successfully');
    } catch (err: any) {
      console.error('Failed to update player:', err);
      notificationService.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(player?.name || '');
    setEditing(false);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error || !player) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error || 'Player not found'}</Alert>
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
          <IconButton onClick={() => navigate(-1)}>
            <BackIcon />
          </IconButton>
          <Typography variant="h6" flex={1}>
            Player Profile
          </Typography>
        </Box>
      </Box>

      {/* Profile Header */}
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Avatar
          sx={{
            width: 120,
            height: 120,
            mx: 'auto',
            mb: 2,
            fontSize: '3rem',
            bgcolor: 'primary.main',
          }}
        >
          {player.name.charAt(0).toUpperCase()}
        </Avatar>

        {editing ? (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
            <TextField
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              size="small"
              sx={{ maxWidth: 300 }}
            />
            <IconButton onClick={handleSave} disabled={saving} color="primary">
              {saving ? <CircularProgress size={24} /> : <SaveIcon />}
            </IconButton>
            <IconButton onClick={handleCancelEdit} disabled={saving}>
              <CancelIcon />
            </IconButton>
          </Box>
        ) : (
          <Box display="flex" alignItems="center" justifyContent="center" gap={1}>
            <Typography variant="h5">{player.name}</Typography>
            {canEditName && (
              <IconButton size="small" onClick={() => setEditing(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {player.email}
        </Typography>

        <Box display="flex" gap={1} justifyContent="center" mt={2}>
          <Chip label={player.status} color={player.status === 'approved' ? 'success' : 'warning'} />
          <Chip label={player.role} variant="outlined" />
        </Box>
      </Box>

      <Divider />

      {/* Stats Overview */}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Statistics
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {/* Training Stats */}
          <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 200 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Training Fights
                </Typography>
                <Box display="flex" gap={1} alignItems="baseline">
                  <Typography variant="h4">{player.fightStats?.training?.wins || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    / {(player.fightStats?.training?.wins || 0) + (player.fightStats?.training?.losses || 0) + (player.fightStats?.training?.draws || 0)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {(() => {
                    const total = (player.fightStats?.training?.wins || 0) + (player.fightStats?.training?.losses || 0) + (player.fightStats?.training?.draws || 0);
                    return total > 0 ? Math.round(((player.fightStats?.training?.wins || 0) / total) * 100) : 0;
                  })()}
                  % win rate
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Competitive Stats */}
          <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 200 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Competitive Fights
                </Typography>
                <Box display="flex" gap={1} alignItems="baseline">
                  <Typography variant="h4">{player.fightStats?.competitive?.wins || 0}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    / {(player.fightStats?.competitive?.wins || 0) + (player.fightStats?.competitive?.losses || 0) + (player.fightStats?.competitive?.draws || 0)}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {(() => {
                    const total = (player.fightStats?.competitive?.wins || 0) + (player.fightStats?.competitive?.losses || 0) + (player.fightStats?.competitive?.draws || 0);
                    return total > 0 ? Math.round(((player.fightStats?.competitive?.wins || 0) / total) * 100) : 0;
                  })()}
                  % win rate
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Current Streak */}
          <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 200 }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <FireIcon color="error" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Current Streak
                  </Typography>
                </Box>
                <Typography variant="h4">
                  {player.currentStreak?.count || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {player.currentStreak?.type || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Best Streak */}
          <Box sx={{ flex: '1 1 calc(50% - 8px)', minWidth: 200 }}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <TrophyIcon color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    Best Streak
                  </Typography>
                </Box>
                <Typography variant="h4">
                  {player.bestStreak?.count || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {player.bestStreak?.type || 'N/A'}
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      <Divider />

      {/* Star Trophies */}
      {player.starTrophies && player.starTrophies.length > 0 && (
        <>
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Star Trophies
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {player.starTrophies.map((trophy: any, index: number) => (
                <Box key={index} sx={{ flex: '1 1 calc(25% - 16px)', minWidth: 150 }}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <TrophyIcon
                        sx={{ fontSize: 48, color: STAR_COLORS[trophy.starType] || '#999', mb: 1 }}
                      />
                      <Typography variant="subtitle2">{trophy.starType}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(trophy.awardedAt), 'PP')}
                      </Typography>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
          </Box>
          <Divider />
        </>
      )}

      {/* Fight History */}
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>
          Fight History
        </Typography>

        {fights.length === 0 ? (
          <Alert severity="info">No fight history available</Alert>
        ) : (
          <Timeline position={isMobile ? 'right' : 'alternate'}>
            {fights.map((fight, index) => {
              const isWinner = (fight.winner._id || fight.winner.id) === (player._id || player.id);
              const opponent = (fight.team1Player._id || fight.team1Player.id) === (player._id || player.id) ? fight.team2Player : fight.team1Player;

              return (
                <TimelineItem key={fight._id || fight.id}>
                  {!isMobile && (
                    <TimelineOppositeContent color="text.secondary">
                      {format(new Date(fight.reportedAt), 'PP')}
                    </TimelineOppositeContent>
                  )}
                  <TimelineSeparator>
                    <TimelineDot color={isWinner ? 'success' : 'error'}>
                      <FightIcon />
                    </TimelineDot>
                    {index < fights.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  <TimelineContent>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle2">
                          {isWinner ? 'Won' : 'Lost'} vs {opponent.name}
                        </Typography>
                        {isMobile && (
                          <Typography variant="caption" color="text.secondary">
                            {format(new Date(fight.reportedAt), 'PP')}
                          </Typography>
                        )}
                      </CardContent>
                    </Card>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
        )}
      </Box>
    </Box>
  );
}
