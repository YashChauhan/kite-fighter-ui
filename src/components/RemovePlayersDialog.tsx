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
  Chip,
} from "@mui/material";
import { ExpandMore, ExpandLess } from "@mui/icons-material";
import type { Match, MatchPlayer, BulkOperationResponse, Player } from "../types";
import { removePlayersFromTeam } from "../api/matches";
import notificationService from "../services/notificationService";

interface RemovePlayersDialogProps {
  open: boolean;
  onClose: () => void;
  match: Match;
  teamId: string;
  onSuccess: () => void;
}

export const RemovePlayersDialog: React.FC<RemovePlayersDialogProps> = ({
  open,
  onClose,
  match,
  teamId,
  onSuccess,
}) => {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkOperationResponse | null>(null);
  const [showFailedDetails, setShowFailedDetails] = useState(true);

  const teams = match.teams || [match.team1, match.team2].filter(Boolean);
  const team = teams?.find((t) => t?.teamId === teamId);
  const teamPlayers = team?.players || [];

  // Filter out captain and confirmed players
  const removablePlayers = teamPlayers.filter(
    (player) =>
      !player.isCaptain &&
      player.confirmationStatus !== "confirmed",
  );

  const removablePlayerIds = removablePlayers.map((p) => {
    const pid = typeof p.playerId === "string" 
      ? p.playerId 
      : (p.playerId as Player)?._id || (p.playerId as Player)?.id;
    return pid;
  });

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
    if (selectedPlayers.length === removablePlayerIds.length) {
      setSelectedPlayers([]);
    } else {
      setSelectedPlayers(removablePlayerIds);
    }
  };

  const handleSubmit = async () => {
    if (selectedPlayers.length === 0) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await removePlayersFromTeam(
        match._id || match.id,
        teamId,
        selectedPlayers,
      );
      setResult(response);

      if (response.success.length > 0) {
        notificationService.success(
          `Successfully removed ${response.success.length} player(s)`,
        );
        onSuccess();
      }

      if (response.failed.length > 0) {
        notificationService.warning(
          `Failed to remove ${response.failed.length} player(s). See details below.`,
        );
      }

      // Clear successful selections, keep failed ones
      setSelectedPlayers(response.failed.map((f) => f.playerId));
    } catch (error) {
      notificationService.error(
        error instanceof Error ? error.message : "Failed to remove players",
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
    return team?.teamName || teamId;
  };

  const isPlayerRemovable = (player: MatchPlayer): boolean => {
    const pid = typeof player.playerId === "string" 
      ? player.playerId 
      : (player.playerId as Player)?._id || (player.playerId as Player)?.id;
    return removablePlayerIds.includes(pid);
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Remove Players from {getTeamName()}</DialogTitle>
      <DialogContent>
        {isOffline && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            You are offline. Roster management is disabled.
          </Alert>
        )}

        <Alert severity="info" sx={{ mb: 2 }}>
          You can only remove players who are <strong>pending</strong> or{" "}
          <strong>declined</strong>. Captains and confirmed players cannot be
          removed.
        </Alert>

        {teamPlayers.length === 0 && (
          <Alert severity="info">No players in this team.</Alert>
        )}

        {removablePlayers.length === 0 && teamPlayers.length > 0 && (
          <Alert severity="warning">
            No players can be removed. All players are either captains or have
            confirmed their participation.
          </Alert>
        )}

        {removablePlayers.length > 0 && (
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
                {selectedPlayers.length} of {removablePlayers.length} selected
              </Typography>
              <Button
                size="small"
                onClick={handleSelectAll}
                disabled={loading || isOffline}
              >
                {selectedPlayers.length === removablePlayerIds.length
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </Box>

            <FormGroup>
              {teamPlayers.map((player) => {
                const playerId = typeof player.playerId === "string" 
                  ? player.playerId 
                  : (player.playerId as Player)?._id || (player.playerId as Player)?.id;
                const isRemovable = isPlayerRemovable(player);

                return (
                  <Box
                    key={playerId}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      opacity: isRemovable ? 1 : 0.5,
                    }}
                  >
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedPlayers.includes(playerId)}
                          onChange={() => handleTogglePlayer(playerId)}
                          disabled={!isRemovable || loading || isOffline}
                        />
                      }
                      label={player.playerName}
                      sx={{ flexGrow: 1 }}
                    />
                    <Box sx={{ display: "flex", gap: 1 }}>
                      <Chip
                        label={player.confirmationStatus}
                        size="small"
                        color={
                          player.confirmationStatus === "confirmed"
                            ? "success"
                            : player.confirmationStatus === "declined"
                              ? "error"
                              : "default"
                        }
                      />
                      {player.isCaptain && (
                        <Chip label="Captain" size="small" color="primary" />
                      )}
                    </Box>
                  </Box>
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
                Successfully removed {result.success.length} player(s) from the
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
                    Failed to remove {result.failed.length} player(s)
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
                      const player = teamPlayers.find((p) => {
                        const pid = typeof p.playerId === "string" 
                          ? p.playerId 
                          : (p.playerId as Player)?._id || (p.playerId as Player)?.id;
                        return pid === playerId;
                      });
                      return (
                        <ListItem key={playerId} sx={{ px: 0 }}>
                          <ListItemText
                            primary={player?.playerName || playerId}
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
          color="error"
          disabled={loading || selectedPlayers.length === 0 || isOffline}
          startIcon={loading && <CircularProgress size={20} />}
        >
          {loading
            ? "Removing..."
            : `Remove ${selectedPlayers.length} Player${selectedPlayers.length !== 1 ? "s" : ""}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
