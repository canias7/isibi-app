import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from "recharts"

const chartData = [
  { day: "Mon", value: 38 },
  { day: "Tue", value: 24 },
  { day: "Wed", value: 41 },
  { day: "Thu", value: 56 },
  { day: "Fri", value: 78 },
  { day: "Sat", value: 94 },
  { day: "Sun", value: 12 },
]

const chartConfig = {
  value: { label: "Bookings", color: "var(--chart-1)" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nightingale Rose</CardTitle>
        <CardDescription>Sectors of equal angle, varying radius.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[270px] w-full">
          <RadarChart data={chartData}>
            <PolarGrid gridType="circle" />
            <PolarAngleAxis dataKey="day" fontSize={11} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Radar dataKey="value" fill="var(--color-value)" fillOpacity={0.6} stroke="var(--color-value)" />
          </RadarChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Saturday is the busiest day <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
