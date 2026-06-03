import * as React from "react";
import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";

interface PipelineRun {
  id: number;
  runId: string;
  status: "success" | "failure" | "running";
  repositoriesProcessed: number;
  originalPayload: string | null;
  enrichedData: string | null;
  createdAt: string;
  completedAt: string | null;
}

export default function PipelineRunsView() {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/pipeline/runs");
      const data = await response.json();

      if (data.success) {
        setRuns(data.runs);
      } else {
        setError(data.error || "Failed to fetch pipeline runs");
      }
    } catch (err) {
      setError("Network error: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (runId: number) => {
    const newExpanded = new Set(expandedRuns);
    if (newExpanded.has(runId)) {
      newExpanded.delete(runId);
    } else {
      newExpanded.add(runId);
    }
    setExpandedRuns(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "failure":
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case "running":
        return <ClockIcon className="h-5 w-5 text-yellow-500 animate-pulse" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      success: "default" as const,
      failure: "destructive" as const,
      running: "secondary" as const,
    };
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const parseJSON = (jsonString: string | null) => {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading pipeline runs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={fetchRuns} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const successCount = runs.filter((r) => r.status === "success").length;
  const failureCount = runs.filter((r) => r.status === "failure").length;
  const runningCount = runs.filter((r) => r.status === "running").length;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline Runs</h1>
          <p className="text-muted-foreground">
            GitHub Actions repository intelligence pipeline execution history
          </p>
        </div>
        <Button onClick={fetchRuns}>
          <RefreshCwIcon className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <RefreshCwIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircleIcon className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{successCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircleIcon className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{failureCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <ClockIcon className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{runningCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Runs List */}
      <Card>
        <CardHeader>
          <CardTitle>All Pipeline Runs</CardTitle>
          <CardDescription>Click on a run to view detailed payload and enrichment data</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Run ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Repositories</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <React.Fragment key={run.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => toggleExpand(run.id)}
                  >
                    <TableCell>
                      {expandedRuns.has(run.id) ? (
                        <ChevronUpIcon className="h-4 w-4" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{run.runId}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(run.status)}
                        {getStatusBadge(run.status)}
                      </div>
                    </TableCell>
                    <TableCell>{run.repositoriesProcessed}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(run.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.completedAt ? formatDate(run.completedAt) : "-"}
                    </TableCell>
                  </TableRow>
                  {expandedRuns.has(run.id) && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <div className="space-y-4 p-4">
                          {/* Original Payload */}
                          {run.originalPayload && (
                            <div>
                              <h4 className="mb-2 text-sm font-semibold">Original GitHub Data</h4>
                              <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
                                {JSON.stringify(parseJSON(run.originalPayload), null, 2)}
                              </pre>
                            </div>
                          )}

                          <Separator />

                          {/* Enriched Data */}
                          {run.enrichedData && (
                            <div>
                              <h4 className="mb-2 text-sm font-semibold">AI-Enriched Analysis</h4>
                              <pre className="overflow-auto rounded-md bg-muted p-4 text-xs">
                                {JSON.stringify(parseJSON(run.enrichedData), null, 2)}
                              </pre>
                            </div>
                          )}

                          {!run.originalPayload && !run.enrichedData && (
                            <div className="text-center text-sm text-muted-foreground">
                              No detailed data available for this run
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
