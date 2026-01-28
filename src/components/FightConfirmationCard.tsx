import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Box,
  Typography,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  Alert,
  Avatar,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  HourglassEmpty as PendingIcon,
} from '@mui/icons-material';
import type { Fight, Match, FightResult } from '../types';
import { FightResult as FightResultEnum } from '../types';
import * as fightsApi from '../api/fights';
import notificationService from '../services/notificationService';

interface FightConfirmationCardProps {
  fight: Fight;
  currentUserId: string;
  match: Match;
  onConfirmed?: (fight: Fight) => void;
}

export const FightConfirmationCard: React.FC<FightConfirmationCardProps> = ({
  fight,
  currentUserId,
  match,
  onConfirmed,
}) => {
  const [loading, setLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<FightResult | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Check if current user is a captain
  const isCaptain = match.teams?.some(
    team => {
      const captainId = typeof team.captain?.playerId === 'object' 
        ? (team.captain.playerId as any)?._id || (team.captain.playerId as any)?.id
        : team.captain?.playerId;
      return captainId === currentUserId;
    }
  );

  // Check if current user already confirmed
  const hasConfirmed = fight.captainConfirmations?.some(
    conf => conf.captainId === currentUserId
  );

  // Check if fight is still pending
  const isPending = fight.status === 'pending_captain_confirmation';

  // Pre-select the proposed result
  useEffect(() => {
    if (isPending && !hasConfirmed && fight.proposedResult) {
      setSelectedResult(fight.proposedResult);
    }
  }, [fight.proposedResult, isPending, hasConfirmed]);

  const handleConfirm = async () => {
    if (!selectedResult) {
      setError('Please select a result');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const updatedFight = await fightsApi.confirmFight({
        fightId: fight._id || fight.id,
        captainId: currentUserId,
        agreedResult: selectedResult,
        notes: notes || undefined,
      });

      notificationService.success('✅ Fight result confirmed!');
      
      if (onConfirmed) {
        onConfirmed(updatedFight);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to confirm fight';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getResultLabel = (result: FightResult): string => {
    switch (result) {
      case FightResultEnum.PLAYER1_WIN:
        return 'Player 1 Wins';
      case FightResultEnum.PLAYER2_WIN:
        return 'Player 2 Wins';
      case FightResultEnum.DRAW:
        return 'Draw';
      default:
        return result;
    }
  };

  const getPlayerName = (playerData: any): string => {
    if (typeof playerData === 'string') return 'Player';
    return playerData?.playerName || playerData?.name || 'Player';
  };

  // Don't show if not a captain
  if (!isCaptain) return null;

  // Don't show if current user reported the fight (reporting = auto-confirmation)
  const wasReportedByCurrentUser = fight.reportedBy?.playerId === currentUserId;
  if (wasReportedByCurrentUser) {
    // User reported this fight, so they've already confirmed it implicitly
    return null;
  }

  // Get captain info for both teams
  const team1Captain = match.teams?.[0]?.captain;
  const team2Captain = match.teams?.[1]?.captain;
  
  const team1CaptainId = typeof team1Captain?.playerId === 'object'
    ? (team1Captain.playerId as any)?._id || (team1Captain.playerId as any)?.id
    : team1Captain?.playerId;
  
  const team2CaptainId = typeof team2Captain?.playerId === 'object'
    ? (team2Captain.playerId as any)?._id || (team2Captain.playerId as any)?.id
    : team2Captain?.playerId;

  const team1CaptainConfirmed = fight.captainConfirmations?.some(c => c.captainId === team1CaptainId);
  const team2CaptainConfirmed = fight.captainConfirmations?.some(c => c.captainId === team2CaptainId);

  // Show confirmation status if already confirmed
  if (hasConfirmed) {
    const myConfirmation = fight.captainConfirmations?.find(
      conf => conf.captainId === currentUserId
    );
    
    const otherCaptainConfirmed = currentUserId === team1CaptainId ? team2CaptainConfirmed : team1CaptainConfirmed;
    const myTeamName = currentUserId === team1CaptainId 
      ? match.teams?.[0]?.teamName || 'Team 1'
      : match.teams?.[1]?.teamName || 'Team 2';
    const otherTeamName = currentUserId === team1CaptainId
      ? match.teams?.[1]?.teamName || 'Team 2' 
      : match.teams?.[0]?.teamName || 'Team 1';

    return (
      <Card sx={{ mb: 2, bgcolor: otherCaptainConfirmed ? 'success.light' : 'warning.light', opacity: 0.8 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            {otherCaptainConfirmed ? <CheckIcon color="success" /> : <PendingIcon color="warning" />}
            <Typography variant="subtitle1" fontWeight="bold">
              {otherCaptainConfirmed ? '✅ Both Captains Confirmed' : '⏳ Waiting for Other Captain'}
            </Typography>
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>{myTeamName} Captain (You):</strong> ✅ Confirmed as <strong>{getResultLabel(myConfirmation?.agreedResult || fight.result)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>{otherTeamName} Captain:</strong> {otherCaptainConfirmed ? '✅ Confirmed' : '⏳ Pending'}
            </Typography>
          </Box>
          
          {myConfirmation?.notes && (
            <>
              <Divider sx={{ my: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                Your note: {myConfirmation.notes}
              </Typography>
            </>
          )}

          <Divider sx={{ my: 1 }} />

          <Typography variant="caption" color="text.secondary">
            You confirmed at: {new Date(myConfirmation?.confirmedAt || '').toLocaleString()}
          </Typography>
        </CardContent>
      </Card>
    );
  }

  // Show confirmation form if pending
  if (isPending) {
    const player1Name = getPlayerName(fight.player1);
    const player2Name = getPlayerName(fight.player2);
    const reporterName = fight.reportedBy?.playerName || 'A player';

    return (
      <Card sx={{ mb: 2, border: '2px solid', borderColor: 'warning.main' }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <PendingIcon color="warning" />
            <Typography variant="subtitle1" fontWeight="bold">
              ⏳ Fight Awaiting Your Confirmation
            </Typography>
          </Box>

          <Box display="flex" gap={2} mb={2} alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                {player1Name.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2">{player1Name}</Typography>
            </Box>
            
            <Typography variant="h6" color="text.secondary">VS</Typography>
            
            <Box display="flex" alignItems="center" gap={1}>
              <Avatar sx={{ bgcolor: 'secondary.main' }}>
                {player2Name.charAt(0).toUpperCase()}
              </Avatar>
              <Typography variant="body2">{player2Name}</Typography>
            </Box>
          </Box>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>{reporterName}</strong> reported the result as:{' '}
              <strong>{getResultLabel(fight.proposedResult || fight.result)}</strong>
            </Typography>
            {fight.resultNote && (
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block', fontStyle: 'italic' }}>
                Note: {fight.resultNote}
              </Typography>
            )}
          </Alert>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Typography variant="subtitle2" gutterBottom>
            Do you agree with this result?
          </Typography>

          <RadioGroup
            value={selectedResult}
            onChange={(e) => setSelectedResult(e.target.value as FightResult)}
          >
            <FormControlLabel
              value={FightResultEnum.PLAYER1_WIN}
              control={<Radio />}
              label={`${player1Name} wins`}
            />
            <FormControlLabel
              value={FightResultEnum.PLAYER2_WIN}
              control={<Radio />}
              label={`${player2Name} wins`}
            />
            <FormControlLabel
              value={FightResultEnum.DRAW}
              control={<Radio />}
              label="Draw"
            />
          </RadioGroup>

          <TextField
            fullWidth
            multiline
            rows={2}
            label="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any comments about this fight..."
            sx={{ my: 2 }}
            inputProps={{ maxLength: 500 }}
            helperText={`${notes.length}/500 characters`}
          />

          <Box display="flex" gap={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={handleConfirm}
              disabled={loading || !selectedResult}
              startIcon={loading ? <CircularProgress size={20} /> : <CheckIcon />}
              fullWidth
            >
              {loading ? 'Confirming...' : 'Confirm Result'}
            </Button>
          </Box>

          {fight.captainConfirmations && fight.captainConfirmations.length > 0 && (
            <Box mt={2}>
              <Divider sx={{ mb: 1 }} />
              <Typography variant="caption" color="text.secondary">
                ℹ️ {fight.captainConfirmations.length}/2 captains confirmed
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  return null;
};
