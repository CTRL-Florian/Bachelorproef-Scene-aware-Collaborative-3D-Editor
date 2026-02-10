import { useState } from 'react'
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAddBoxPopupStore } from "@/popups/hooks/useAddBoxPopupStore"
import { useSceneObjectManipulation } from "@/playground/scene/hooks/useSceneObjectManipulation"

const AddBoxPopup: React.FC = () => {
    const isOpen = useAddBoxPopupStore((state) => state.isOpen);
    const close = useAddBoxPopupStore((state) => state.close);
    const { addBox } = useSceneObjectManipulation();

    const [x, setX] = useState('0');
    const [y, setY] = useState('0');
    const [z, setZ] = useState('0');
    const [width, setWidth] = useState('3');
    const [height, setHeight] = useState('3');
    const [length, setLength] = useState('3');
    const [color, setColor] = useState('#FFA500'); // orange
    const [rotX, setRotX] = useState('0');
    const [rotY, setRotY] = useState('0');
    const [rotZ, setRotZ] = useState('0');

    // Helper: graden naar radialen
    const degToRad = (deg: number) => deg * Math.PI / 180;
    const handleAddBox = () => {
        const position: [number, number, number] = [
            parseFloat(x) || 0,
            parseFloat(y) || 0,
            parseFloat(z) || 0,
        ];
        const rotation: [number, number, number] = [
            degToRad(parseFloat(rotX) || 0),
            degToRad(parseFloat(rotY) || 0),
            degToRad(parseFloat(rotZ) || 0),
        ];
        addBox(position, color, rotation);
        // Reset form
        setX('0');
        setY('0');
        setZ('0');
        setWidth('3');
        setHeight('3');
        setLength('3');
        setColor('#FFA500');
        setRotX('0');
        setRotY('0');
        setRotZ('0');
        // Close dialog
        close();
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="flex fixed inset-0 z-[100] items-center justify-center bg-black/50 backdrop-blur-sm">
                <Card className="w-full max-w-sm">
                    <CardHeader>
                        <CardTitle>Add Box</CardTitle>
                        <CardDescription>
                            Enter the coordinates, dimensions, and color for the new box.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form>
                            <div className="flex flex-col gap-4">
                                <div className="grid gap-2">
                                    <Label>Position (X, Y, Z)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="xCoord"
                                            type="number"
                                            placeholder="X"
                                            value={x}
                                            onChange={(e) => setX(e.target.value)}
                                            step="0.1"
                                        />
                                        <Input
                                            id="yCoord"
                                            type="number"
                                            placeholder="Y"
                                            value={y}
                                            onChange={(e) => setY(e.target.value)}
                                            step="0.1"
                                        />
                                        <Input
                                            id="zCoord"
                                            type="number"
                                            placeholder="Z"
                                            value={z}
                                            onChange={(e) => setZ(e.target.value)}
                                            step="0.1"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Dimensions</Label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Label className="text-xs text-gray-500">Width</Label>
                                            <Input
                                                id="width"
                                                type="number"
                                                placeholder="Width"
                                                value={width}
                                                onChange={(e) => setWidth(e.target.value)}
                                                step="0.1"
                                                min="0.1"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs text-gray-500">Height</Label>
                                            <Input
                                                id="height"
                                                type="number"
                                                placeholder="Height"
                                                value={height}
                                                onChange={(e) => setHeight(e.target.value)}
                                                step="0.1"
                                                min="0.1"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Label className="text-xs text-gray-500">Length</Label>
                                            <Input
                                                id="length"
                                                type="number"
                                                placeholder="Length"
                                                value={length}
                                                onChange={(e) => setLength(e.target.value)}
                                                step="0.1"
                                                min="0.1"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label>Rotation (°) X Y Z</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            id="rotX"
                                            type="number"
                                            placeholder="X"
                                            value={rotX}
                                            onChange={(e) => setRotX(e.target.value)}
                                            step="1"
                                        />
                                        <Input
                                            id="rotY"
                                            type="number"
                                            placeholder="Y"
                                            value={rotY}
                                            onChange={(e) => setRotY(e.target.value)}
                                            step="1"
                                        />
                                        <Input
                                            id="rotZ"
                                            type="number"
                                            placeholder="Z"
                                            value={rotZ}
                                            onChange={(e) => setRotZ(e.target.value)}
                                            step="1"
                                        />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="color">Box Color</Label>
                                    <Input
                                        id="color"
                                        type="color"
                                        value={color}
                                        onChange={(e) => setColor(e.target.value)}
                                    />
                                </div>
                            </div>
                        </form>
                    </CardContent>
                    <CardFooter className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={close}>
                            Cancel
                        </Button>
                        <Button className="flex-1" onClick={handleAddBox}>
                            Add Box
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </>
    );
};

export default AddBoxPopup;
