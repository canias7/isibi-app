import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AccessionBacklog } from "@/components/charts/lib/museum"
const years = [
  { label: "2018", acquired: 1240, catalogued: 980 },
  { label: "2019", acquired: 1410, catalogued: 1020 },
  { label: "2020", acquired: 620, catalogued: 740 },
  { label: "2021", acquired: 1180, catalogued: 890 },
  { label: "2022", acquired: 1520, catalogued: 960 },
  { label: "2023", acquired: 1690, catalogued: 1010 },
  { label: "2024", acquired: 1740, catalogued: 1040 },
  { label: "2025", acquired: 1810, catalogued: 1080 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cataloguing backlog</CardTitle>
        <CardDescription>Whether it is growing, not how big it is</CardDescription>
      </CardHeader>
      <CardContent>
        <AccessionBacklog years={years} staffCapacityPerYear={540} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A count of the backlog would never say this <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight years
        </div>
      </CardFooter>
    </Card>
  )
}
