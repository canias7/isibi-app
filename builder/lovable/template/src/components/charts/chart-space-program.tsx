import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SpaceProgram } from "@/components/charts/lib/building"
const rooms = [
  { name: "Consulting room", count: 12, netM2: 16, group: "Clinical" },
  { name: "Treatment room", count: 4, netM2: 24, group: "Clinical" },
  { name: "Waiting", count: 2, netM2: 90, group: "Public" },
  { name: "Reception", count: 1, netM2: 42, group: "Public" },
  { name: "Office", count: 8, netM2: 12, group: "Staff" },
  { name: "Staff room", count: 1, netM2: 48, group: "Staff" },
  { name: "Store", count: 6, netM2: 9, group: "Support" },
  { name: "Plant", count: 2, netM2: 34, group: "Support" },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule of accommodation</CardTitle>
        <CardDescription>Net grossed up for circulation and plant</CardDescription>
      </CardHeader>
      <CardContent>
        <SpaceProgram rooms={rooms} circulationFactor={0.35} siteGrossM2={1100} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          It fits the site with fifty metres to spare <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          35% gross-up
        </div>
      </CardFooter>
    </Card>
  )
}
