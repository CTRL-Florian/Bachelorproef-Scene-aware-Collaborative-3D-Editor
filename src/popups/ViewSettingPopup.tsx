import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useSceneSettingsStore } from "@/playground/scene/hooks/useSceneSettingsStore"
import { useEffect } from 'react'
import { useKeyboardControls } from '@react-three/drei'

const ViewSettingPopup: React.FC = () => {
    const [subscribeKeys] = useKeyboardControls();
    const toggle = useSceneSettingsStore((state) => state.toggle);
    const color = useSceneSettingsStore((state) => state.color);
    const setColor = useSceneSettingsStore((state) => state.setColor);
    
    useEffect(() => {
        return subscribeKeys(
            (state) => state,
            (state) => {
                if (state.viewsettings) {
                    toggle();
                }
            }
        );
    }, [subscribeKeys]);

    const isOpen = useSceneSettingsStore((state) => state.isOpen);
    if (!isOpen) return null;

    return (
        <>
            <div className="flex fixed inset-0 z-[100] items-center justify-center bg-black/50 backdrop-blur-sm">
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle>Change view settings</CardTitle>
                        <CardDescription>
                        You can change the color of the background and the camera reset position below.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form>
                            <div className="flex flex-col gap-6">
                                <div className="grid gap-2">
                                    <Label htmlFor="color">Background color</Label>
                                    <Input
                                        id="color"
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="camera">Camera reset position</Label>
                                    <div className="flex gap-2">
                                        <Input id="xCamera" type="number" placeholder="x" required />
                                        <Input id="yCamera" type="number" placeholder="y" required />
                                        <Input id="zCamera" type="number" placeholder="z" required />
                                    </div>
                                </div>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className="flex-col gap-2">
                        <Button variant="outline" className="w-full" onClick={toggle}>
                        Close
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </>
    );
};

export default ViewSettingPopup;