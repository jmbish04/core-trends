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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { StarIcon, TrendingUpIcon, ExternalLinkIcon, CalendarIcon } from "lucide-react";

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
  compatibilityFlags: string;
  isAbandonedProject: boolean;
  surveyResponse: string;
  createdAt: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function RepositoriesDashboard() {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepositories();
  }, []);

  const fetchRepositories = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/repositories");
      const data = await response.json();

      if (data.success) {
        setRepositories(data.repositories);
      } else {
        setError(data.error || "Failed to fetch repositories");
      }
    } catch (err) {
      setError("Network error: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const languageData = repositories.reduce((acc, repo) => {
    const lang = repo.language || "Unknown";
    const existing = acc.find((item) => item.name === lang);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: lang, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const topRepositories = [...repositories]
    .sort((a, b) => b.stars - a.stars)
    .slice(0, 10)
    .map((repo) => ({
      name: repo.name,
      stars: repo.stars,
    }));

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading repositories...</div>
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
            <Button onClick={fetchRepositories} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Repository Intelligence</h1>
          <p className="text-muted-foreground">
            Monitoring {repositories.length} trending repositories with AI analysis
          </p>
        </div>
        <Button onClick={fetchRepositories}>
          <TrendingUpIcon className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Repositories</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{repositories.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stars</CardTitle>
            <StarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {repositories.reduce((sum, repo) => sum + repo.stars, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Trending</CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {repositories.filter((repo) => repo.isNewTrending).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Languages</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{languageData.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Repositories by Stars</CardTitle>
            <CardDescription>Most starred repositories in the collection</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topRepositories}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  stroke="hsl(var(--foreground))"
                />
                <YAxis stroke="hsl(var(--foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
                <Bar dataKey="stars" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Language Distribution</CardTitle>
            <CardDescription>Primary programming languages</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={languageData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => entry.name}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {languageData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Repositories Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Repositories</CardTitle>
          <CardDescription>Click on a repository to view detailed AI analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Repository</TableHead>
                <TableHead>Language</TableHead>
                <TableHead>Stars</TableHead>
                <TableHead>Trend Period</TableHead>
                <TableHead>Discovery</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repositories.map((repo) => (
                <TableRow key={repo.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <a
                        href={`/repository/${repo.id}`}
                        className="font-medium hover:underline"
                      >
                        {repo.fullName}
                      </a>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {repo.description}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{repo.language}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <StarIcon className="h-3 w-3" />
                      {repo.stars.toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={repo.isNewTrending ? "default" : "secondary"}>
                      {repo.trendPeriod}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {repo.discoveredMethod.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={repo.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLinkIcon className="h-4 w-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
