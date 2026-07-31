import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ContainerUtilisation } from "@/components/charts/lib/shipping"
const legs = [
  { name: "Shanghai → Singapore", teu: 12400, tonnes: 118000 },
  { name: "Singapore → Suez", teu: 13900, tonnes: 141000 },
  { name: "Suez → Rotterdam", teu: 14600, tonnes: 132000 },
  { name: "Rotterdam → Singapore", teu: 8100, tonnes: 149000 },
  { name: "Singapore → Shanghai", teu: 9600, tonnes: 96000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Slots or deadweight</CardTitle>
        <CardDescription>Which constraint binds first on each leg</CardDescription>
      </CardHeader>
      <CardContent>
        <ContainerUtilisation legs={legs} slotCapacityTeu={15200} deadweightTonnes={152000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Empty slots do not mean an empty ship <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Round voyage
        </div>
      </CardFooter>
    </Card>
  )
}
