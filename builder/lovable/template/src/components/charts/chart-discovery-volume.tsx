import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DiscoveryVolume } from "@/components/charts/lib/legal"
const stages = [
  { name: "Collected", documents: 1240000 },
  { name: "De-duplicated", documents: 742000 },
  { name: "Date filtered", documents: 388000 },
  { name: "Search terms", documents: 96000 },
  { name: "Predictive cull", documents: 71000 },
  { name: "Human review", documents: 71000 },
  { name: "Produced", documents: 9400 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Discovery review</CardTitle>
        <CardDescription>Documents culled at each stage</CardDescription>
      </CardHeader>
      <CardContent>
        <DiscoveryVolume stages={stages} reviewers={6} docsPerHour={48} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Ninety-four percent never reach a human <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1.24M collected
        </div>
      </CardFooter>
    </Card>
  )
}
