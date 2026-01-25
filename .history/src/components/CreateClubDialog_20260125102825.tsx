import { useState } from 'react';
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
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { createClub } from '../api/clubs';
import notificationService from '../services/notificationService';

interface CreateClubDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function CreateClubDialog({ open, onClose, onSuccess }: CreateClubDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [foundedDate, setFoundedDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
