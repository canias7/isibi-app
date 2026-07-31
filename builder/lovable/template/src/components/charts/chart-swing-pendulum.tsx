import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SwingPendulum } from "@/components/charts/lib/elections"
const seats = [
  { name: "Marlow North", holder: "Blue", challenger: "Red", marginPoints: 0.8 },
  { name: "Fenbridge", holder: "Blue", challenger: "Red", marginPoints: 2.4 },
  { name: "Carrick East", holder: "Blue", challenger: "Green", marginPoints: 3.9 },
  { name: "Stowmere", holder: "Blue", challenger: "Red", marginPoints: 6.1 },
  { name: "Aldenwood", holder: "Blue", challenger: "Red", marginPoints: 8.4 },
  { name: "Hartley Vale", holder: "Blue", challenger: "Green", marginPoints: 11.2 },
  { name: "Netherby", holder: "Blue", challenger: "Red", marginPoints: 15.6 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Swing pendulum</CardTitle>
        <CardDescription>The swing each seat needs, in margin order</CardDescription>
      </CardHeader>
      <CardContent>
        <SwingPendulum seats={seats} swing={4.2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Half the margin is the number that matters <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Uniform 4.2%
        </div>
      </CardFooter>
    </Card>
  )
}
