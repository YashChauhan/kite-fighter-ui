import { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Autocomplete,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  CircularProgress,
} from '@mui/material';
import { EmojiEvents as TrophyIcon } from '@mui/icons-material';

import type { Player } from '../types';
import { FightResult } from '../types';
import { reportFight } from '../api/fights';
import notificationService from '../services/notificationService';

interface RecordFightFormProps {
  matchId: string;
  currentUserId: string;
  matchStatus: string;
  team1Players: Player[];
  team2Players: Player[];
  onSuccess: () => void;
  onCancel: () => void;
}

export default function RecordFightForm({
  matchId,
  currentUserId,
  matchStatus,
  team1Players,
  team2Players,
  onSuccess,
  onCancel,
}: RecordFightFormProps) {
  const [team1Player, setTeam1Player] = useState<Player | null>(null);
  const [team2Player, setTeam2Player] = useState<Player | null>(null);
  const [result, setResult] = useState<FightResult | null>(null);
  const [resultNote, setResultNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Validation function
  const canReportFight = () => {
    // 1. Match must be active
    if (matchStatus !== 'active') {
      return {
        allowed: false,
        reason: 'Fight can only be reported during active matches'
      };
    }

    // 2. Both fighters must be different
    if (team1Player && team2Player && 
        (team1Player._id || team1Player.id) === (team2Player._id || team2Player.id)) {
      return {
        allowed: false,
        reason: 'Cannot report a fight between the same player'
      };
    }

    // Note: Backend will validate if reporter is a participant and players are confirmed
    return { allowed: true };
  };

  const handleSubmit = async () => {
    setError(null);

    // Run validations
    const validation = canReportFight();
    if (!validation.allowed) {
      setError(validation.reason || 'Cannot report fight');
      notificationService.error(validation.reason || 'Cannot report fight');
      return;
    }

    // Field validation
    if (!team1Player || !team2Player) {
      setError('Please select both players');
      return;
    }

    if (!result) {
      setError('Please select a fight result');
      return;
    }

    try {
      setSubmitting(true);

      const player1Id = (team1Player._id || team1Player.id) as string;
      const player2Id = (team2Player._id || team2Player.id) as string;

      if (!player1Id || !player2Id) {
        setError('Invalid player selection');
        return;
      }

      await reportFight({
        matchId,
        reporterId: currentUserId,
        player1Id,
        player2Id,
        result,
        resultNote: resultNote.trim() || undefined,
      });

      notificationService.success('✅ Fight reported! Waiting for captain confirmation.');
      onSuccess();
    } catch (err: any) {
      console.error('Failed to report fight:', err);
      const errorMessage = err.response?.data?.message || '';
      
      // Handle specific error cases
      if (errorMessage.includes('Reporter must be')) {
        setError('You must be a match participant to report fights');
      } else if (errorMessage.includes('Both players must be')) {
        setError('Both fighters must be confirmed match participants');
      } else if (errorMessage.includes('not found') || errorMessage.includes('not active')) {
        setError('Match not found or is no longer active');
      } else {
        setError(errorMessage || 'Failed to record fight');
      }
      
      notificationService.error(errorMessage || 'Failed to record fight');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Record Fight Result
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Team 1 Player */}
      <Autocomplete
        options={team1Players}
        getOptionLabel={(player) => player.name}
        value={team1Player}
        onChange={(_, newValue) => setTeam1Player(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Team 1 Player"
            required
            helperText="Select player from team 1"
          />
        )}
        renderOption={(props, player) => {
          const { key, ...optionProps } = props;
          return (
            <Box component="li" key={key} {...optionProps}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <Typography flex={1}>{player.name}</Typography>
                {player.currentStreak && player.currentStreak.count > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {player.currentStreak.count} streak
                  </Typography>
                )}
              </Box>
            </Box>
          );
        }}
        sx={{ mb: 2 }}
        fullWidth
      />

      {/* VS Indicator */}
      <Box sx={{ textAlign: 'center', my: 2 }}>
        <Typography variant="h5" color="text.secondary">
          VS
        </Typography>
      </Box>

      {/* Team 2 Player */}
      <Autocomplete
        options={team2Players}
        getOptionLabel={(player) => player.name}
        value={team2Player}
        onChange={(_, newValue) => setTeam2Player(newValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Team 2 Player"
            required
            helperText="Select player from team 2"
          />
        )}
        renderOption={(props, player) => {
          const { key, ...optionProps } = props;
          return (
            <Box component="li" key={key} {...optionProps}>
              <Box display="flex" alignItems="center" gap={1} width="100%">
                <Typography flex={1}>{player.name}</Typography>
                {player.currentStreak && player.currentStreak.count > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    {player.currentStreak.count} streak
                  </Typography>
                )}
              </Box>
            </Box>
          );
        }}
        sx={{ mb: 3 }}
        fullWidth
      />

      {/* Result Selection */}
      <Typography variant="subtitle2" gutterBottom>
        Fight Result *
      </Typography>
      <ToggleButtonGroup
        value={result}
        exclusive
        onChange={(_, newResult) => setResult(newResult)}
        fullWidth
        sx={{ mb: 3 }}
      >
        <ToggleButton value={FightResult.TEAM1_WIN} color="primary">
          <Box textAlign="center">
            <TrophyIcon sx={{ display: 'block', mx: 'auto', mb: 0.5 }} />
            <Typography variant="caption">Team 1 Win</Typography>
          </Box>
        </ToggleButton>
        <ToggleButton value={FightResult.DRAW} color="standard">
          <Box textAlign="center">
            <Typography variant="caption">Draw</Typography>
          </Box>
        </ToggleButton>
        <ToggleButton value={FightResult.TEAM2_WIN} color="secondary">
          <Box textAlign="center">
            <TrophyIcon sx={{ display: 'block', mx: 'auto', mb: 0.5 }} />
            <Typography variant="caption">Team 2 Win</Typography>
          </Box>
        </ToggleButton>
      </ToggleButtonGroup>

      {/* Result Note (Optional) */}
      <TextField
        label="Notes (Optional)"
        multiline
        rows={3}
        value={resultNote}
        onChange={(e) => setResultNote(e.target.value)}
        placeholder="Add any details about the fight..."
        helperText={`${resultNote.length}/500 characters`}
        inputProps={{ maxLength: 500 }}
        fullWidth
        sx={{ mb: 3 }}
      />

      {/* Action Buttons */}
      <Box display="flex" gap={2}>
        <Button
          variant="outlined"
          fullWidth
          onClick={onCancel}
          disabled={submitting}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          fullWidth
          onClick={handleSubmit}
          disabled={submitting || !team1Player || !team2Player || !result}
        >
          {submitting ? <CircularProgress size={24} /> : 'Record Fight'}
        </Button>
      </Box>

      <Alert severity="info" sx={{ mt: 2 }}>
        ⏳ Fight will be pending captain confirmation. Both team captains must confirm the result.
      </Alert>
    </Box>
  );
}
