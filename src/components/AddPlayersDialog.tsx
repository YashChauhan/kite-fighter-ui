import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Alert,
  AlertTitle,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Collapse,
  IconButton,
  CircularProgress,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import type { Player, Match, BulkOperationResponse } from "../types";
import { addPlayersToTeam } from "../api/matches";
import { getAvailablePlayersForMatch } from "../utils/matchPermissions";
import notificationService from "../services/notificationService";

interface AddPlayersDialogProps {
  open: boolean;
  onClose: () => void;
  match: Match;
  teamId: string;
  availablePlayers: Player[];
  onSuccess: () => void;
}

export const AddPlayersDialog: React.FC<AddPlayersDialogProps> = ({
  open,
  onClose,
  match,
  teamId,
  availablePlayers,
  onSuccess,
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkOperationResponse | null>(null);
  const [showFailedDetails, setShowFailedDetails] = useState(true);

  // Filter out players already in the match
  const eligiblePlayers = getAvailablePlayersForMatch(availablePlayers, match);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedPlayers([]);
      setResult(null);
      setShowFailedDetails(true);
    }
  }, [open]);

  // Check if user is offline
  const isOffline = !navigator.onLine;

  const handleTogglePlayer = (playerId: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId],
    );
  };

  const handleSelectAll = () => {
    if (selectedPlayers.length === eligiblePlayers.length) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers(eligiblePlayers.map((p) => p._id || p.id));
    }
  };

  const handleSubmit = async () => {
    if (selectedPlayers.length === 0) return;
    if (selectedPlayers.length > 20) {
      notificationService.error("Maximum 20 players can be added at once");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await addPlayersToTeam(
        match._id || match.id,
        teamId,
        selectedPlayers,
      );
      setResult(response);

      if (response.success.length > 0) {
        notificationService.success(
          `Successfully added ${response.success.length} player(s)`,
        );
        onSuccess();
      }

      if (response.failed.length > 0) {
        notificationService.warning(
          `Failed to add ${response.failed.length} player(s). See details below.`,
        );
      }

      // Clear successful selections, keep failed ones for retry
      setSelectedPlayers(response.failed.map((f) => f.playerId));
    } catch (error) {
      notificationService.error(
        error instanceof Error ? error.message : "Failed to add players",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const getTeamName = () => {
    const teams = match.teams || [match.team1, match.team2].filter(Boolean);
    const team = teams?.find((t) => t?.teamId === teamId);
    return team?.teamName || teamId;
  };

  const isMaxReached = selectedPlayers.length > 20;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Players to {getTeamName()}</DialogTitle>
      <DialogContent>
        {isOffline && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You are offline. Roster management is disabled.
          </Alert>
        )}

        {eligiblePlayers.length === 0 && (
          <Alert severity="info">
            No available players to add. All club members are already in the
            match.
          </Alert>
        )}

        {eligiblePlayers.length > 0 && (
          <>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {selectedPlayers.length} of {eligiblePlayers.length} selected
                {isMaxReached && (
                  <Typography
                    component="span"
                    color="error"
                    sx={{ ml: 1, fontWeight: "bold" }}
                  >
                    (max 20 allowed)
                  </Typography>
                )}
              </Typography>
              <Button
                size="small"
                onClick={handleSelectAll}
                disabled={loading || isOffline}
              >
                {selectedPlayers.length === eligiblePlayers.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </Box>

            <FormGroup>
              {eligiblePlayers.map((player) => {
                const playerId = player._id || player.id;
                return (
                  <FormControlLabel
                    key={playerId}
                    control={
                      <Checkbox
                        checked={selectedPlayers.includes(playerId)}
                        onChange={() => handleTogglePlayer(playerId)}
                        disabled={loading || isOffline}
                      />
                    }
                    label={player.name}
                  />
                );
              })}
            </FormGroup>
          </>
        )}

        {/* Result Display - Partial Success Handling */}
        {result && (
          <Box sx={{ mt: 3 }}>
            {result.success?.length > 0 && (
              <Alert severity="success" sx={{ mb: 2 }}>
                <AlertTitle>Success</AlertTitle>
                Successfully added {result.success.length} player(s) to the
                team
              </Alert>
            )}

            {result.failed?.length > 0 && (
              <Alert severity="warning">
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <AlertTitle>
                    Failed to add {result.failed.length} player(s)
                  </AlertTitle>
                  <IconButton
                    size="small"
                    onClick={() => setShowFailedDetails(!showFailedDetails)}
                  >
                    {showFailedDetails ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
                <Collapse in={showFailedDetails}>
                  <List dense>
                    {result.failed.map(({ playerId, reason }) => {
                      const player = eligiblePlayers.find(
                        (p) => (p._id || p.id) === playerId,
                      );
                      return (
                        <ListItem key={playerId} sx={{ px: 0 }}>
                          <ListItemText
                            primary={player?.name || playerId}
                            secondary={reason}
                          />
                        </ListItem>
                      );
                    })}
                  </List>
                </Collapse>
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          {result && result.failed?.length === 0 ? "Close" : "Cancel"}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={
            loading ||
            selectedPlayers.length === 0 ||
            isMaxReached ||
            isOffline
          }
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading
            ? "Adding..."
            : `Add ${selectedPlayers.length} Player${selectedPlayers.length !== 1 ? "s" : ""}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
