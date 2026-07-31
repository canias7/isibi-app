import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SlopeChart, SERVICE_SLOPES } from "./lib/slope"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Slope</CardTitle>
        <CardDescription>Sorted by how much moved.</CardDescription>
      </CardHeader>
      <CardContent>
        <SlopeChart items={SERVICE_SLOPES} fromLabel="H1" toLabel="H2" sortBy="change" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour nearly doubled <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
