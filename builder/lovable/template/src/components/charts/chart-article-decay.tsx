import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ArticleDecay } from "@/components/charts/lib/publish"
const mk = (title: string, peak: number, halfDays: number) => ({
  title,
  daily: Array.from({ length: 30 }, (_, d) => Math.round(peak * Math.pow(0.5, d / halfDays)) + 20),
})
const articles = [
  mk("Breaking: council vote", 42000, 0.7),
  mk("Explainer: how the levy works", 9000, 6),
  mk("Recipe: winter stew", 3200, 22),
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How long a piece lives</CardTitle>
        <CardDescription>Traffic after publication</CardDescription>
      </CardHeader>
      <CardContent>
        <ArticleDecay articles={articles} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Half-life separates news from evergreen <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Log scale
        </div>
      </CardFooter>
    </Card>
  )
}
