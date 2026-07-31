import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WaterProfile } from "@/components/charts/lib/brewing"
const source = { calcium: 42, magnesium: 6, sodium: 18, sulphate: 34, chloride: 26, bicarbonate: 118 }
const target = { calcium: 130, magnesium: 12, sodium: 22, sulphate: 240, chloride: 55, bicarbonate: 60 }

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Water chemistry</CardTitle>
        <CardDescription>Source water against the target profile</CardDescription>
      </CardHeader>
      <CardContent>
        <WaterProfile source={source} target={target} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The ratio decides balance, not the totals <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Burton-ish
        </div>
      </CardFooter>
    </Card>
  )
}
