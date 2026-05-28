import * as React from "react";
import { useState, useEffect } from "react";
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
  StarIcon,
  ExternalLinkIcon,
  TrendingUpIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CodeIcon,
  GitBranchIcon,
} from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

interface Repository {
  id: number;
  githubId: number;
  name: string;
  owner: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number;
  trendPeriod: string;
  isNewTrending: boolean;
  isStarredByUser: boolean;
  discoveredMethod: string;
  createdAt: string;
  updatedAt: string;
}

interface Evaluation {
  id: number;
  repositoryId: number;
  score: number;
  rationale: string;
  compatibilityFlags: string | null;
  isAbandonedProject: boolean;
  surveyResponse: string | null;
  createdAt: string;
}

interface RepositoryDetailViewProps {
  repositoryId: string;
}

export default function RepositoryDetailView({ repositoryId }: RepositoryDetailViewProps) {
  const [repository, setRepository] = useState<Repository | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  useEffect(() => {
    fetchRepositoryDetails();
  }, [repositoryId]);

  const fetchRepositoryDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/repositories/${repositoryId}`);
      const data = await response.json();

      if (data.success) {
        setRepository(data.repository);
        setEvaluations(data.evaluations);
      } else {
        setError(data.error || "Failed to fetch repository details");
      }
    } catch (err) {
      setError("Network error: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const triggerEvaluation = async () => {
    if (isEvaluating) return;

    try {
      setIsEvaluating(true);
      const response = await fetch(`/api/repositories/${repositoryId}/evaluate`, {
        method: "POST",
      });
      const data = await response.json();

      if (data.success) {
        // Refresh data after evaluation
        setTimeout(() => {
          fetchRepositoryDetails();
          setIsEvaluating(false);
        }, 2000);
      } else {
        setIsEvaluating(false);
      }
    } catch (err) {
      console.error("Evaluation error:", err);
      setIsEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading repository details...</div>
      </div>
    );
  }

  if (error || !repository) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error || "Repository not found"}</p>
            <Button onClick={() => window.history.back()} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const latestEvaluation = evaluations[0];
  const parseCompatibilityFlags = (flags: string | null) => {
    if (!flags) return null;
    try {
      return JSON.parse(flags);
    } catch {
      return null;
    }
  };

  // Prepare radar chart data from evaluation
  const radarData = latestEvaluation
    ? [
        { category: "Quality", score: latestEvaluation.score },
        { category: "Cloudflare Compatible", score: latestEvaluation.score * 0.9 },
        { category: "Documentation", score: latestEvaluation.score * 0.8 },
        { category: "Community", score: Math.min(10, repository.stars / 1000) },
        { category: "Maintenance", score: latestEvaluation.isAbandonedProject ? 0 : 8 },
      ]
    : [];

  return (
    <div className="container mx-auto space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{repository.fullName}</h1>
          <p className="text-muted-foreground">{repository.description}</p>
        </div>
        <Button asChild>
          <a href={repository.url} target="_blank" rel="noopener noreferrer">
            <ExternalLinkIcon className="mr-2 h-4 w-4" />
            View on GitHub
          </a>
        </Button>
      </div>

      {/* Repository Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stars</CardTitle>
            <StarIcon className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repository.stars.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Language</CardTitle>
            <CodeIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repository.language}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trend Period</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge>{repository.trendPeriod}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Discovery Method</CardTitle>
            <GitBranchIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <span className="text-xs">{repository.discoveredMethod.replace(/_/g, " ")}</span>
          </CardContent>
        </Card>
      </div>

      {/* Evaluation Section */}
      {latestEvaluation ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>AI Evaluation Score</CardTitle>
              <CardDescription>Latest evaluation from AI agent</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis
                    dataKey="category"
                    stroke="hsl(var(--foreground))"
                    tick={{ fill: "hsl(var(--foreground))" }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 10]} stroke="hsl(var(--foreground))" />
                  <Radar
                    name="Score"
                    dataKey="score"
                    stroke="hsl(var(--primary))"
                    fill="hsl(var(--primary))"
                    fillOpacity={0.6}
                  />
                </RadarChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center">
                <div className="text-4xl font-bold">{latestEvaluation.score}/10</div>
                <div className="text-sm text-muted-foreground">Overall Quality Score</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Rationale</CardTitle>
              <CardDescription>
                Evaluated on {new Date(latestEvaluation.createdAt).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{latestEvaluation.rationale}</p>
              {latestEvaluation.isAbandonedProject && (
                <Badge variant="destructive">Project appears abandoned</Badge>
              )}
              {parseCompatibilityFlags(latestEvaluation.compatibilityFlags) && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Compatibility Flags</h4>
                  <pre className="rounded-md bg-muted p-2 text-xs">
                    {JSON.stringify(
                      parseCompatibilityFlags(latestEvaluation.compatibilityFlags),
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
              <Button onClick={triggerEvaluation} variant="outline" className="w-full" disabled={isEvaluating}>
                {isEvaluating ? "Evaluating..." : "Re-evaluate Repository"}
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Evaluation Available</CardTitle>
            <CardDescription>This repository hasn't been evaluated by the AI yet</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={triggerEvaluation} disabled={isEvaluating}>
              <TrendingUpIcon className="mr-2 h-4 w-4" />
              {isEvaluating ? "Evaluating..." : "Trigger AI Evaluation"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Evaluation History */}
      {evaluations.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Evaluation History</CardTitle>
            <CardDescription>Previous AI evaluations for this repository</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {evaluations.slice(1).map((evaluation) => (
              <div key={evaluation.id} className="space-y-2 rounded-md border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    Score: {evaluation.score}/10
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(evaluation.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">{evaluation.rationale}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
