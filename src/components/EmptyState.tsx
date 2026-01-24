import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { SportsKabaddi, Add } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  showAction?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  showAction = true,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 4,
          textAlign: 'center',
          bgcolor: 'background.default',
          maxWidth: 400,
        }}
      >
        <SportsKabaddi
          sx={{
            fontSize: 80,
            color: 'text.secondary',
            mb: 2,
          }}
        />
        <Typography variant="h5" gutterBottom color="text.primary">
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {description}
        </Typography>
        {showAction && actionLabel && onAction && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={onAction}
            size="large"
          >
            {actionLabel}
          </Button>
        )}
      </Paper>
    </Box>
  );
};
