import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
  Autocomplete,
  Chip,
  FormControl,
  FormLabel,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { createClub } from '../api/clubs';
import { getPlayers } from '../api/players';
import notificationService from '../services/notificationService';
import type { Player } from '../types';
import { ApprovalStatus } from '../types';

interface CreateClubDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateClubDialog({ open, onClose, onSuccess }: CreateClubDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [foundedDate, setFoundedDate] = useState('');
  const [owner, setOwner] = useState<Player | null>(null);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [approvedPlayers, setApprovedPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load approved players when dialog opens
  useEffect(() => {
    if (open) {
      loadApprovedPlayers();
    }
  }, [open]);

  const loadApprovedPlayers = async () => {
    setLoadingPlayers(true);
    try {
      const response = await getPlayers({ 
        limit: 1000, // Get all approved players
        page: 1 
      });
      // Filter only approved players
      const approved = response.data.filter(p => p.status === ApprovalStatus.APPROVED);
      setApprovedPlayers(approved);
    } catch (err) {
      console.error('Failed to load players:', err);
      notificationService.error('Failed to load players');
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Club name is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await createClub({
        name: name.trim(),
        description: description.trim() || undefined,
        foundedDate: foundedDate || undefined,
      });

      notificationService.success('Club created successfully!');
      handleClose();
      onSuccess?.();
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || 'Failed to create club';
      setError(errorMessage);
      notificationService.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setName('');
      setDescription('');
      setFoundedDate('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New Club</DialogTitle>
        
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <TextField
              label="Club Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              autoFocus
              disabled={loading}
              placeholder="Enter club name"
              helperText="The name of the kite fighting club"
            />

            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              disabled={loading}
              placeholder="Enter club description (optional)"
              helperText="A brief description of the club"
            />

            <TextField
              label="Founded Date"
              type="date"
              value={foundedDate}
              onChange={(e) => setFoundedDate(e.target.value)}
              fullWidth
              disabled={loading}
              InputLabelProps={{
                shrink: true,
              }}
              helperText="When the club was established (optional)"
            />
          </Box>
        </DialogContent>

        <DialogActions>
          <Button 
            onClick={handleClose} 
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !name.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
          >
            {loading ? 'Creating...' : 'Create Club'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
