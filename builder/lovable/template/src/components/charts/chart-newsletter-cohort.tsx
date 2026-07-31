import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { NewsletterCohort } from "@/components/charts/lib/publish"
const cohorts = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((name, i) => {
  const size = 1800 + i * 260
  const quality = 0.86 + i * 0.012
  return {
    name, size,
    retained: Array.from({ length: 6 - i }, (_, p) => Math.round(size * Math.pow(quality, p))),
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Retention by signup month</CardTitle>
        <CardDescription>Read down, not across</CardDescription>
      </CardHeader>
      <CardContent>
        <NewsletterCohort cohorts={cohorts} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Down a column is the fair comparison <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Six cohorts
        </div>
      </CardFooter>
    </Card>
  )
}
