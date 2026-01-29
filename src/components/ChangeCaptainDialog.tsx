import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Box,
  Typography,
  CircularProgress,
  Chip,
} from "@mui/material";
import type { Match, Player } from "../types";
import { changeCaptain } from "../api/matches";
import notificationService from "../services/notificationService";

interface ChangeCaptainDialogProps {
  open: boolean;
  onClose: () => void;
  match: Match;
  teamId: string;
  onSuccess: () => void;
}

export const ChangeCaptainDialog: React.FC<ChangeCaptainDialogProps> = ({
  open,
  onClose,
  match,
  teamId,
  onSuccess,
}) => {
  const [newCaptainId, setNewCaptainId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const team = match.teams.find((t) => t.teamId === teamId);
  const teamPlayers = team?.players || [];
  const currentCaptainId =
    typeof team?.captain?.playerId === "string"
      ? team.captain.playerId
      : (team?.captain?.playerId as Player)?._id ||
        (team?.captain?.playerId as Player)?.id;

  // Filter out current captain
  const eligiblePlayers = teamPlayers.filter((player) => {
    const playerId =
      typeof player.playerId === "string"
        ? player.playerId
        : (player.playerId as Player)?._id ||
          (player.playerId as Player)?.id;
    return playerId !== currentCaptainId;
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setNewCaptainId("");
      setShowConfirm(false);
    }
  }, [open]);

  // Check if user is offline
  const isOffline = !navigator.onLine;

  const handleSubmit = async () => {
    if (!newCaptainId) return;

    setLoading(true);

    try {
      await changeCaptain(match._id || match.id, teamId, newCaptainId);
      notificationService.success(
        "Captain changed successfully. Both captains have been notified.",
      );
      onSuccess();
      onClose();
    } catch (error) {
      notificationService.error(
        error instanceof Error ? error.message : "Failed to change captain",
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

  const handleConfirm = () => {
    setShowConfirm(true);
  };

  const handleCancelConfirm = () => {
    setShowConfirm(false);
  };

  const getTeamName = () => {
    return team?.teamName || teamId;
  };

  const getCurrentCaptainName = () => {
    const captain = teamPlayers.find((player) => {
      const playerId =
        typeof player.playerId === "string"
          ? player.playerId
          : (player.playerId as Player)?._id ||
            (player.playerId as Player)?.id;
      return playerId === currentCaptainId;
    });
    return captain?.playerName || "Unknown";
  };

  const getNewCaptainName = () => {
    const newCaptain = eligiblePlayers.find((player) => {
      const playerId =
        typeof player.playerId === "string"
          ? player.playerId
          : (player.playerId as Player)?._id ||
            (player.playerId as Player)?.id;
      return playerId === newCaptainId;
    });
    return newCaptain?.playerName || "";
  };

  return (
    <>
      {/* Main Dialog */}
      <Dialog
        open={open && !showConfirm}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Captain for {getTeamName()}</DialogTitle>
        <DialogContent>
          {isOffline && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              You are offline. Roster management is disabled.
            </Alert>
          )}

          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Current Captain
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="body1">{getCurrentCaptainName()}</Typography>
              <Chip label="Captain" size="small" color="primary" />
            </Box>
          </Box>

          <Alert severity="info" sx={{ mb: 3 }}>
            Changing the captain will reset confirmation status for both the old
            and new captain. Both captains will receive notifications about this
            change.
          </Alert>

          {eligiblePlayers.length === 0 && (
            <Alert severity="warning">
              No other players available to become captain. Add more players to
              the team first.
            </Alert>
          )}

          {eligiblePlayers.length > 0 && (
            <FormControl fullWidth>
              <InputLabel id="new-captain-label">Select New Captain</InputLabel>
              <Select
                labelId="new-captain-label"
                value={newCaptainId}
                label="Select New Captain"
                onChange={(e) => setNewCaptainId(e.target.value)}
                disabled={loading || isOffline}
              >
                {eligiblePlayers.map((player) => {
                  const playerId =
                    typeof player.playerId === "string"
                      ? player.playerId
                      : (player.playerId as Player)?._id ||
                        (player.playerId as Player)?.id;
                  return (
                    <MenuItem key={playerId} value={playerId}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          width: "100%",
                        }}
                      >
                        <span>{player.playerName}</span>
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
                      </Box>
                    </MenuItem>
                  );
                })}
              </Select>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            disabled={loading || !newCaptainId || isOffline}
          >
            Change Captain
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onClose={handleCancelConfirm} maxWidth="xs">
        <DialogTitle>Confirm Captain Change</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to change the captain?
          </Typography>
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>From:</strong> {getCurrentCaptainName()}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>To:</strong> {getNewCaptainName()}
            </Typography>
          </Box>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Both captains will be notified of this change and will need to
            confirm their participation again.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelConfirm} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={loading}
            startIcon={loading && <CircularProgress size={20} />}
          >
            {loading ? "Changing..." : "Confirm Change"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
