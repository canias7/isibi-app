import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TensileComparison } from "@/components/charts/lib/materials"
// The curve must actually REACH the stated UTS, or the component correctly
// reports a strength nobody asked for.
const mk = (name: string, uts: number, eFail: number, yieldAt: number) => ({
  name,
  points: Array.from({ length: 40 }, (_, i) => {
    const strain = (i / 39) * eFail
    if (strain <= yieldAt) return { strain: Number(strain.toFixed(4)), stress: Number(((strain / yieldAt) * uts * 0.7).toFixed(1)) }
    const t = (strain - yieldAt) / (eFail - yieldAt)
    return { strain: Number(strain.toFixed(4)), stress: Number((uts * (0.7 + 0.3 * Math.sin((t * Math.PI) / 2))).toFixed(1)) }
  }),
})
const materials = [
  mk("Mild steel", 420, 0.22, 0.0012),
  mk("Aluminium 6061", 310, 0.12, 0.0035),
  mk("Cast iron", 250, 0.008, 0.0018),
  mk("CFRP", 1500, 0.014, 0.0135),
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strength against toughness</CardTitle>
        <CardDescription>Stress-strain to failure</CardDescription>
      </CardHeader>
      <CardContent>
        <TensileComparison materials={materials} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Toughness is the area, not the peak <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Four materials
        </div>
      </CardFooter>
    </Card>
  )
}
