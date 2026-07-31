import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AbvAttenuation } from "@/components/charts/lib/brewing"
const batches = [
  { name: "Pale ale #14", og: 1.052, fg: 1.009 },
  { name: "Pale ale #15", og: 1.054, fg: 1.008 },
  { name: "IPA #7", og: 1.066, fg: 1.018 },
  { name: "Bitter #3", og: 1.042, fg: 1.008 },
  { name: "Porter #2", og: 1.058, fg: 1.014 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Attenuation</CardTitle>
        <CardDescription>Each batch against the strain's published range</CardDescription>
      </CardHeader>
      <CardContent>
        <AbvAttenuation batches={batches} strainRange={{ low: 81, high: 86 }} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One batch stalled well short <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          US-05, 81–86%
        </div>
      </CardFooter>
    </Card>
  )
}
