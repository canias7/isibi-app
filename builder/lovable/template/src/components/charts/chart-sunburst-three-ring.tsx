import { TrendingUp } from "lucide-react"
import { SunburstChart } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { type ChartConfig } from "@/components/ui/chart"
const chartData = {
  name: "All bookings",
  value: 800,
  children: [
    {
      name: "Cuts",
      value: 500,
      fill: "var(--chart-1)",
      children: [
        {
          name: "Fade",
          value: 300,
          fill: "var(--chart-2)",
          children: [
            { name: "Skin", value: 180, fill: "var(--chart-3)" },
            { name: "Low", value: 120, fill: "var(--chart-4)" },
          ],
        },
        { name: "Trim", value: 200, fill: "var(--chart-5)" },
      ],
    },
    { name: "Grooming", value: 300, fill: "var(--chart-3)" },
  ],
}

const chartConfig = {
  value: { label: "Bookings" },
} satisfies ChartConfig

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sunburst Chart</CardTitle>
        <CardDescription>Bookings by service, then by variant.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <SunburstChart
            width={280}
            height={280}
            data={chartData}
            dataKey="value"
            textOptions={{ fontSize: "10", fill: "var(--background)" }}
          />
        </div>
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Fades are 62% of all cuts <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
