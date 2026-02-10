import ViewPort from '@/playground/ViewPort';
import SceneGraph from '@/playground/SceneGraph';

const Playground: React.FC = () => {
    return (
        <>
            <div className='w-full h-full flex mx-auto items-center'>
                <div className='flex-grow h-full'>
                    <ViewPort />
                </div>
                <SceneGraph />
            </div>
        </>
    );
};

export default Playground;
