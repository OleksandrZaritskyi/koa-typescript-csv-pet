import { useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { uploadCsv } from '../api';

interface Props {
  onUploaded: (jobId: string) => void;
}

export function UploadForm({ onUploaded }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      const result = await uploadCsv(file);
      setMessage(`Job created: ${result.jobId}`);
      onUploaded(result.jobId);
      setFile(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setMessage(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
      <Stack spacing={2} direction={{ xs: 'column', sm: 'row' }} alignItems="center">
        <Button
          variant="outlined"
          component="label"
          startIcon={<CloudUploadIcon />}
          disabled={uploading}
        >
          Choose CSV
          <input
            type="file"
            accept=".csv"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </Button>
        <Typography variant="body2" sx={{ flex: 1 }}>
          {file ? file.name : 'No file selected'}
        </Typography>
        <Button type="submit" variant="contained" disabled={!file || uploading}>
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </Stack>
      {message && (
        <Typography variant="body2" color="secondary" sx={{ mt: 1 }}>
          {message}
        </Typography>
      )}
    </Box>
  );
}
