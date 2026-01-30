import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Divider,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Check as ApproveIcon,
  Close as RejectIcon,
  Person as PersonIcon,
  AdminPanelSettings as AdminIcon,
  Star as StarIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material';
import {
  getClubMembers,
  getPendingJoinRequests,
  reviewJoinRequest,
  updateMemberRole,
} from '../api/clubs';
import { useAuth } from '../contexts/AuthContext';
import notificationService from '../services/notificationService';
import { format } from 'date-fns';

interface ClubMembershipManagementProps {
  clubId: string;
  onUpdate?: () => void;
}

interface Member {
  playerId: string;
  playerName: string;
  playerEmail: string;
  role: 'owner' | 'co_owner' | 'member';
  joinedAt: string;
}

interface JoinRequest {
  playerId: string;
  playerName: string;
  playerEmail: string;
  requestedAt: string;
  status: string;
}

export default function ClubMembershipManagement({
  clubId,
  onUpdate,
}: ClubMembershipManagementProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<JoinRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [newRole, setNewRole] = useState<'owner' | 'co_owner' | 'member'>('member');
  
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState(false);

  useEffect(() => {
    loadData();
  }, [clubId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [membersData, requestsData] = await Promise.all([
        getClubMembers(clubId),
        getPendingJoinRequests(clubId).catch(() => []),
      ]);
      
      setMembers(membersData);
      setPendingRequests(requestsData.filter((r: JoinRequest) => r.status === 'pending'));
    } catch (err: any) {
      console.error('Failed to load membership data:', err);
      setError(err.response?.data?.message || 'Failed to load membership data');
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (): 'owner' | 'co_owner' | 'member' | null => {
    if (!user) return null;
    const member = members.find(
      (m) => m.playerId === (user._id || user.id)
    );
    return member?.role || null;
  };

  const isOwner = () => getUserRole() === 'owner';
  const isOwnerOrCoOwner = () => {
    const role = getUserRole();
    return role === 'owner' || role === 'co_owner';
  };

  const handleApproveRequest = async (request: JoinRequest) => {
    try {
      setProcessingRequest(request.playerId);
      await reviewJoinRequest(clubId, request.playerId, true);
      notificationService.success(`Approved ${request.playerName}'s join request`);
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      notificationService.error(
        err.response?.data?.message || 'Failed to approve request'
      );
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      notificationService.error('Please provide a rejection reason');
      return;
    }

    try {
      setProcessingRequest(selectedRequest.playerId);
      await reviewJoinRequest(
        clubId,
        selectedRequest.playerId,
        false,
        rejectionReason
      );
      notificationService.success(`Rejected ${selectedRequest.playerName}'s join request`);
      setRejectDialogOpen(false);
      setRejectionReason('');
      setSelectedRequest(null);
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      notificationService.error(
        err.response?.data?.message || 'Failed to reject request'
      );
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleChangeRole = async () => {
    if (!selectedMember) return;

    try {
      setChangingRole(true);
      await updateMemberRole(
        clubId,
        selectedMember.playerId._id,
        newRole
      );
      notificationService.success(
        `Updated ${selectedMember.playerId.name}'s role to ${newRole.replace('_', '-')}`
      );
      setRoleChangeDialogOpen(false);
      setSelectedMember(null);
      await loadData();
      onUpdate?.();
    } catch (err: any) {
      notificationService.error(
        err.response?.data?.message || 'Failed to update role'
      );
    } finally {
      setChangingRole(false);
    }
  };

  const openRejectDialog = (request: JoinRequest) => {
    setSelectedRequest(request);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const openRoleChangeDialog = (member: Member) => {
    setSelectedMember(member);
    setNewRole(member.role);
    setRoleChangeDialogOpen(true);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <AdminIcon color="primary" />;
      case 'co_owner':
        return <StarIcon color="secondary" />;
      default:
        return <PersonIcon />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'primary';
      case 'co_owner':
        return 'secondary';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!isOwnerOrCoOwner()) {
    return (
      <Alert severity="info">
        Only club owners and co-owners can manage memberships.
      </Alert>
    );
  }

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}
      >
        <Tab
          label={
            <Box display="flex" alignItems="center" gap={0.5}>
              <span>Pending Requests</span>
              {pendingRequests.length > 0 && (
                <Chip
                  label={pendingRequests.length}
                  size="small"
                  color="warning"
                  sx={{ height: 18, minWidth: 18, '& .MuiChip-label': { px: 0.5 } }}
                />
              )}
            </Box>
          }
        />
        <Tab label={`Members (${members.length})`} />
      </Tabs>

      {activeTab === 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Pending Join Requests
            </Typography>
            {pendingRequests.length === 0 ? (
              <Alert severity="info">No pending join requests</Alert>
            ) : (
              <List>
                {pendingRequests.map((request, index) => (
                  <Box key={request.playerId}>
                    {index > 0 && <Divider />}
                    <ListItem
                      sx={{ 
                        px: 0,
                        py: 2,
                        alignItems: 'center',
                      }}
                    >
                      <Box display="flex" alignItems="center" flex={1} width="100%">
                        <ListItemAvatar>
                          <Avatar>
                            {request.playerName.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={request.playerName}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
                                {request.playerEmail}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Requested {format(new Date(request.requestedAt), 'MMM dd, yyyy')}
                              </Typography>
                            </Box>
                          }
                        />
                      </Box>
                      <Box display="flex" gap={1} flexShrink={0} ml={1}>
                        <IconButton
                          color="success"
                          onClick={() => handleApproveRequest(request)}
                          disabled={processingRequest === request.playerId}
                          title="Approve"
                          size="small"
                        >
                          <ApproveIcon />
                        </IconButton>
                        <IconButton
                          color="error"
                          onClick={() => openRejectDialog(request)}
                          disabled={processingRequest === request.playerId}
                          title="Reject"
                          size="small"
                        >
                          <RejectIcon />
                        </IconButton>
                      </Box>
                    </ListItem>
                  </Box>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 1 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Club Members
            </Typography>
            <List>
              {members.map((member, index) => (
                <Box key={member.playerId}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{ px: 0 }}
                    secondaryAction={
                      isOwner() &&
                      member.playerId !== user?._id &&
                      member.playerId !== user?.id ? (
                        <IconButton
                          edge="end"
                          onClick={() => openRoleChangeDialog(member)}
                          title="Change role"
                        >
                          <MoreIcon />
                        </IconButton>
                      ) : null
                    }
                  >
                    <ListItemAvatar>
                      <Avatar>{getRoleIcon(member.role)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1">
                            {member.playerName}
                          </Typography>
                          <Chip
                            label={member.role.replace('_', '-')}
                            size="small"
                            color={getRoleColor(member.role) as any}
                          />
                          {(member.playerId === user?._id ||
                            member.playerId === user?.id) && (
                            <Chip label="You" size="small" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {member.playerEmail}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Joined {format(new Date(member.joinedAt), 'MMM dd, yyyy')}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Join Request</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Please provide a reason for rejecting {selectedRequest?.playerName}'s request:
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g., Club is currently full"
            sx={{ mt: 2 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRejectRequest}
            variant="contained"
            color="error"
            disabled={!rejectionReason.trim() || !!processingRequest}
          >
            {processingRequest ? 'Rejecting...' : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={roleChangeDialogOpen}
        onClose={() => setRoleChangeDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Change Member Role</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Change {selectedMember?.playerId.name}'s role:
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={newRole}
              label="Role"
              onChange={(e) =>
                setNewRole(e.target.value as 'owner' | 'co_owner' | 'member')
              }
            >
              <MenuItem value="member">Member</MenuItem>
              <MenuItem value="co_owner">Co-Owner</MenuItem>
              <MenuItem value="owner">Owner</MenuItem>
            </Select>
          </FormControl>
          <Alert severity="info" sx={{ mt: 2 }}>
            {newRole === 'owner' && (
              <>
                <strong>Owner:</strong> Full control over the club, can manage all members and approve/reject requests.
              </>
            )}
            {newRole === 'co_owner' && (
              <>
                <strong>Co-Owner:</strong> Can approve/reject join requests, but cannot change member roles.
              </>
            )}
            {newRole === 'member' && (
              <>
                <strong>Member:</strong> Regular club member with no administrative privileges.
              </>
            )}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRoleChangeDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleChangeRole}
            variant="contained"
            disabled={changingRole || newRole === selectedMember?.role}
          >
            {changingRole ? 'Updating...' : 'Update Role'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
