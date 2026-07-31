import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EmissionsWedge } from "@/components/charts/lib/climate"
const years = Array.from({ length: 6 }, (_, i) => 2025 + i * 5)
const businessAsUsual = [41, 44, 47, 50, 53, 56]
const target = [41, 34, 26, 18, 10, 4]
const wedges = [
  { name: "Efficiency", cut: [0, 3, 6, 9, 12, 15] },
  { name: "Renewables", cut: [0, 4, 8, 13, 18, 22] },
  { name: "Electrified transport", cut: [0, 1, 3, 6, 8, 10] },
  { name: "Land use", cut: [0, 1, 2, 3, 4, 4] },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Closing the gap</CardTitle>
        <CardDescription>Wedges against business as usual</CardDescription>
      </CardHeader>
      <CardContent>
        <EmissionsWedge years={years} businessAsUsual={businessAsUsual} target={target} wedges={wedges} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Nothing closes it alone <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          To 2050
        </div>
      </CardFooter>
    </Card>
  )
}
