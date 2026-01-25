import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Box,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  ArrowBack as BackIcon,
  PersonAdd as AddMemberIcon,
} from '@mui/icons-material';
import { getClubById, getClubPlayers } from '../api/clubs';
import type { Club, Player } from '../types';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/notificationService';
import apiClient from '../api/client';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function ClubManagementPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [club, setClub] = useState<Club | null>(null);
  const [members, setMembers] = useState<Player[]>([]);
  const [pendingMembers, setPendingMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (clubId) {
      loadClubData();
    }
  }, [clubId]);

  const loadClubData = async () => {
    if (!clubId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get club with populated players
      const clubData = await getClubById(clubId, true);
      setClub(clubData);
      
      // Check if players are populated (objects) or just IDs (strings)
      if (Array.isArray(clubData.players) && clubData.players.length > 0) {
        const firstPlayer = clubData.players[0];
        
        if (typeof firstPlayer === 'object' && firstPlayer !== null) {
          // Players are populated
          const approved = clubData.players.filter((p: any) => 
            p.membershipStatus === 'approved' || !p.membershipStatus
          );
          const pending = clubData.players.filter((p: any) => 
            p.membershipStatus === 'pending'
          );
          setMembers(approved as Player[]);
          setPendingMembers(pending);
          
          // Check if user is owner
          const isOwnerCheck = approved.some((p: any) => 
            (p._id || p.id) === (user?._id || user?.id) && p.isOwner === true
          );
          
          if (!isOwnerCheck) {
            notificationService.error('You are not the owner of this club');
            navigate('/clubs');
          }
        } else {
          // Players are just IDs, try to fetch from /clubs/:id/players endpoint
          try {
            const playersData = await getClubPlayers(clubId);
            const approved = playersData.data.filter((p: any) => 
              p.membershipStatus === 'approved' || !p.membershipStatus
            );
            const pending = playersData.data.filter((p: any) => 
              p.membershipStatus === 'pending'
            );
            setMembers(approved);
            setPendingMembers(pending);
            
            // Check if user is owner
            const isOwnerCheck = approved.some((p: any) => 
              (p._id || p.id) === (user?._id || user?.id) && p.isOwner === true
            );
            
            if (!isOwnerCheck) {
              notificationService.error('You are not the owner of this club');
              navigate('/clubs');
            }
          } catch (playersErr) {
            console.log('Could not fetch club players');
            notificationService.error('Failed to load club members');
            navigate('/clubs');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load club data:', err);
      setError(err.response?.data?.message || 'Failed to load club data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveMember = async (memberId: string) => {
    if (!clubId) return;
    
    try {
      await apiClient.post(`/clubs/${clubId}/members/${memberId}/approve`);
      notificationService.success('Member approved successfully');
      
      // Move from pending to members
      const member = pendingMembers.find(m => (m._id || m.id) === memberId);
      if (member) {
        setPendingMembers(prev => prev.filter(m => (m._id || m.id) !== memberId));
        setMembers(prev => [...prev, { ...member, membershipStatus: 'approved' }]);
      }
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to approve member');
    }
  };

  const handleRejectMember = async () => {
    if (!clubId || !selectedMemberId) return;
    
    try {
      await apiClient.post(`/clubs/${clubId}/members/${selectedMemberId}/reject`, {
        reason: rejectReason,
      });
      notificationService.success('Member request rejected');
      
      setPendingMembers(prev => prev.filter(m => (m._id || m.id) !== selectedMemberId));
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedMemberId(null);
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to reject member');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!clubId) return;
    
    if (!confirm('Are you sure you want to remove this member from the club?')) {
      return;
    }
    
    try {
      await apiClient.delete(`/clubs/${clubId}/members/${memberId}`);
      notificationService.success('Member removed successfully');
      setMembers(prev => prev.filter(m => (m._id || m.id) !== memberId));
    } catch (err: any) {
      notificationService.error(err.response?.data?.message || 'Failed to remove member');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error || !club) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error || 'Club not found'}</Alert>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/clubs')} sx={{ mt: 2 }}>
          Back to Clubs
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/clubs')} sx={{ mb: 2 }}>
          Back to Clubs
        </Button>
        <Typography variant="h4" gutterBottom>
          Manage {club.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage members and club settings
        </Typography>
      </Box>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
            <Tab 
              label={`Members (${members.length})`}
              id="tab-0"
            />
            <Tab 
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  Pending Requests
                  {pendingMembers.length > 0 && (
                    <Chip 
                      label={pendingMembers.length} 
                      size="small" 
                      color="warning"
                    />
                  )}
                </Box>
              }
              id="tab-1"
            />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          {members.length === 0 ? (
            <Alert severity="info">No members yet</Alert>
          ) : (
            <List>
              {members.map((member: any) => (
                <ListItem
                  key={member._id || member.id}
                  secondaryAction={
                    !member.isOwner && (
                      <Button
                        color="error"
                        size="small"
                        onClick={() => handleRemoveMember(member._id || member.id)}
                      >
                        Remove
                      </Button>
                    )
                  }
                >
                  <ListItemAvatar>
                    <Avatar>{member.name.charAt(0).toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        {member.name}
                        {member.isOwner && (
                          <Chip label="Owner" size="small" color="primary" />
                        )}
                      </Box>
                    }
                    secondary={member.email}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          {pendingMembers.length === 0 ? (
            <Alert severity="info">No pending membership requests</Alert>
          ) : (
            <List>
              {pendingMembers.map((member: any) => (
                <ListItem
                  key={member._id || member.id}
                  secondaryAction={
                    <Box display="flex" gap={1}>
                      <IconButton
                        color="success"
                        onClick={() => handleApproveMember(member._id || member.id)}
                      >
                        <ApproveIcon />
                      </IconButton>
                      <IconButton
                        color="error"
                        onClick={() => {
                          setSelectedMemberId(member._id || member.id);
                          setRejectDialogOpen(true);
                        }}
                      >
                        <RejectIcon />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemAvatar>
                    <Avatar>{member.name.charAt(0).toUpperCase()}</Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={member.name}
                    secondary={member.email}
                  />
                </ListItem>
              ))}
            </List>
          )}
        </TabPanel>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Membership Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Reason"
            fullWidth
            multiline
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Provide a reason for rejection (optional)"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRejectMember} color="error" variant="contained">
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
