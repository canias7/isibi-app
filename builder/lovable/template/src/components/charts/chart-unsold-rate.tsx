import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UnsoldRate } from "@/components/charts/lib/auction"
const bands = [
  { label: "No reserve", lots: 148, unsold: 6, meanLowEstimate: 340 },
  { label: "Reserve under 70% of low", lots: 214, unsold: 21, meanLowEstimate: 620 },
  { label: "70–90% of low", lots: 386, unsold: 62, meanLowEstimate: 880 },
  { label: "At the low estimate", lots: 291, unsold: 84, meanLowEstimate: 1240 },
  { label: "Above the low estimate", lots: 96, unsold: 51, meanLowEstimate: 2100 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bought in</CardTitle>
        <CardDescription>Banded by where the reserve sat</CardDescription>
      </CardHeader>
      <CardContent>
        <UnsoldRate bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The reserve is a conversation, not a taste <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four sales
        </div>
      </CardFooter>
    </Card>
  )
}
