import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Container,
  Typography,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Chip,
  Collapse,
  Box,
  Paper,
  type ChipProps
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import { UploadForm } from './components/UploadForm';
import { fetchJobs, subscribeToJob } from './api';
import { Job } from './types';

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const streams = useRef<Map<string, EventSource>>(new Map());

  const activeJobIds = useMemo(
    () => jobs.filter((j) => j.status === 'pending' || j.status === 'processing').map((j) => j.id),
    [jobs]
  );

  const loadJobs = async () => {
    const list = await fetchJobs();
    setJobs(list);
  };

  useEffect(() => {
    void loadJobs();
    return () => {
      streams.current.forEach((es) => es.close());
    };
  }, []);

  useEffect(() => {
    activeJobIds.forEach((id) => {
      if (streams.current.has(id)) return;
      const es = subscribeToJob(id, (data) => {
        const errors = Object.prototype.hasOwnProperty.call(data, 'errors') ? data.errors : undefined;
        setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...data, errors: errors ?? job.errors } : job)));
      });
      es.onerror = () => {
        es.close();
        streams.current.delete(id);
      };
      es.onopen = () => {
        streams.current.set(id, es);
      };
      es.addEventListener('end', () => {
        es.close();
        streams.current.delete(id);
      });
    });

    const completedIds = Array.from(streams.current.keys()).filter((id) => !activeJobIds.includes(id));
    completedIds.forEach((id) => {
      const es = streams.current.get(id);
      es?.close();
      streams.current.delete(id);
    });
  }, [activeJobIds]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const statusChip = (status: Job['status']) => {
    const color: ChipProps['color'] =
      status === 'completed' ? 'success' : status === 'processing' ? 'primary' : status === 'failed' ? 'error' : 'default';
    return <Chip label={status} color={color} size="small" />;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Typography variant="h4">CSV Processing Dashboard</Typography>
        <UploadForm
          onUploaded={(jobId) => {
            void loadJobs();
            setExpanded((prev) => ({ ...prev, [jobId]: true }));
          }}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Jobs</Typography>
          <Button startIcon={<RefreshIcon />} onClick={() => void loadJobs()}>
            Refresh
          </Button>
        </Stack>
        <Paper>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell />
                <TableCell>Filename</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Progress</TableCell>
                <TableCell>Success</TableCell>
                <TableCell>Failed</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((job) => (
                <React.Fragment key={job.id}>
                  <TableRow hover>
                    <TableCell width={48}>
                      <Button size="small" onClick={() => toggleExpand(job.id)}>
                        <ExpandMoreIcon
                          style={{
                            transform: expanded[job.id] ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 150ms ease'
                          }}
                        />
                      </Button>
                    </TableCell>
                    <TableCell>{job.filename}</TableCell>
                    <TableCell>{statusChip(job.status)}</TableCell>
                    <TableCell>
                      {job.processedRows}/{job.totalRows}
                    </TableCell>
                    <TableCell>{job.successCount}</TableCell>
                    <TableCell>{job.failedCount}</TableCell>
                    <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                      <Collapse in={!!expanded[job.id]} timeout="auto" unmountOnExit>
                        <Box margin={2}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography variant="subtitle1">
                              Errors {job.errors.length > 0 && `(${job.errors.length} total)`}
                            </Typography>
                            {job.errors.length > 0 && (
                              <Button
                                size="small"
                                startIcon={<DownloadIcon />}
                                href={`${import.meta.env.VITE_API_BASE || 'http://localhost:4000/api'}/jobs/${job.id}/errors.csv`}
                                download
                              >
                                Download Error Report
                              </Button>
                            )}
                          </Stack>
                          {job.errors.length === 0 ? (
                            <Typography variant="body2">No errors</Typography>
                          ) : (
                            <>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Row</TableCell>
                                    <TableCell>Message</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {job.errors.slice(0, 100).map((err) => (
                                    <TableRow key={`${job.id}-${err.rowNumber}`}>
                                      <TableCell>{err.rowNumber}</TableCell>
                                      <TableCell>{err.message}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                              {job.errors.length > 100 && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                  Showing first 100 errors. Download the error report to see all {job.errors.length} errors.
                                </Typography>
                              )}
                            </>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Stack>
    </Container>
  );
}
