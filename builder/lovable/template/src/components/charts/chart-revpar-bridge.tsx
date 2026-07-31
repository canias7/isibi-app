import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RevparBridge } from "@/components/charts/lib/hotel"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>RevPAR bridge</CardTitle>
        <CardDescription>The move split into rate and occupancy</CardDescription>
      </CardHeader>
      <CardContent>
        <RevparBridge
          from={{ label: "Last year", occupancy: 0.78, adr: 148 }}
          to={{ label: "This year", occupancy: 0.74, adr: 182 }}
          rooms={214}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A rate-led move costs nothing extra to serve <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Year on year
        </div>
      </CardFooter>
    </Card>
  )
}
